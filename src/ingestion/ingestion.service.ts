import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ClassifiedType, classifyTransaction, defaultSwapMethods } from '../classifier/classifier';
import { PrismaService } from '../common/prisma.service';
import type { NeoClient, NeoTransaction, NeoTransfer } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { formatDate, parseDate } from './date-utils';
import type {
  AssetAggregate,
  BlockIndexState,
  BlockRange,
  ContractAggregate,
  DailySummary,
  MethodAggregate,
  StreamState,
  SwapPriceApiRow,
  SwapPricingContext,
  TransactionBatch,
} from './ingestion.service.types';
import type {
  DailyAssetStatCreateRecord,
  DailyAssetStatRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatRecord,
  DailyStatUpsertRecord,
  DailyTransferCreateRecord,
  DailyTransferPricingRecord,
  DailyTransferRecord,
  DailyTxCreateRecord,
  DailyTxRecord,
  IngestionPrismaClient,
} from './ingestion.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly txBatchSize = 1000;
  private readonly transferBatchSize = 5000;
  private readonly flamingoPriceTimeoutMs = 8000;

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(PrismaService) private readonly prisma: IngestionPrismaClient,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async ingestDay(date: string): Promise<void> {
    this.logger.log(`Starting ingestion for ${date}.`);
    const day = parseDate(date);

    await this.clearDay(day);

    const state: StreamState = {
      day,
      txBuffer: [],
      transferBuffer: [],
      assetMap: new Map<string, AssetAggregate>(),
      methodMap: new Map<string, MethodAggregate>(),
      contractMap: new Map<string, ContractAggregate>(),
      senders: new Set<string>(),
      receivers: new Set<string>(),
      addresses: new Set<string>(),
      swapsCount: 0,
      swapsUsdValue: new Prisma.Decimal(0),
      oracleCount: 0,
      transfersCount: 0,
      gasClaimsCount: 0,
      othersCount: 0,
      neoVolumeRaw: 0n,
      gasVolumeRaw: 0n,
      totalTxCount: 0,
      totalTransfers: 0,
    };
    const pricingContext = await this.createSwapPricingContext();

    let cursor: string | undefined;
    let blockRange: BlockRange | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForDay(date, cursor);
      cursor = response.nextCursor;

      if (!blockRange && response.blockStart !== undefined && response.blockEnd !== undefined) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }

      await this.processTransactionBatch(response.transactions, state, pricingContext);
    } while (cursor);

    await this.flushBuffers(state);

    const dailyAssetStats: DailyAssetStatRecord[] = Array.from(state.assetMap.entries()).map(
      ([asset, aggregate]) => ({
        date: day,
        asset,
        transferCount: aggregate.transferCount,
        txCount: aggregate.txCount,
        uniqueSenders: aggregate.senders.size,
        uniqueReceivers: aggregate.receivers.size,
        volumeRaw: aggregate.volumeRaw,
      }),
    );

    const dailyMethodStats: DailyMethodStatRecord[] = Array.from(state.methodMap.values()).map(
      (stat) => ({
        date: day,
        method: stat.key,
        txCount: stat.count,
      }),
    );

    const dailyContractStats: DailyContractStatRecord[] = Array.from(
      state.contractMap.values(),
    ).map((stat) => ({
      date: day,
      contract: stat.key,
      txCount: stat.count,
    }));

    const blockCount = this.resolveBlockCount(blockRange, state);
    const dailyStat: DailyStatRecord = {
      date: day,
      totalTxCount: state.totalTxCount,
      swapsCount: state.swapsCount,
      swapsUsdValue: this.toUsdStorageValue(state.swapsUsdValue),
      oracleCount: state.oracleCount,
      transfersCount: state.transfersCount,
      gasClaimsCount: state.gasClaimsCount,
      othersCount: state.othersCount,
      realUsageTotal: state.totalTxCount - state.gasClaimsCount,
      totalTransfers: state.totalTransfers,
      uniqueSenders: state.senders.size,
      uniqueReceivers: state.receivers.size,
      uniqueAddresses: state.addresses.size,
      neoVolumeRaw: state.neoVolumeRaw,
      gasVolumeRaw: state.gasVolumeRaw,
      blockCount,
    };

    await this.saveAggregates(day, {
      dailyTx: [],
      dailyTransfers: [],
      dailyAssetStats,
      dailyMethodStats,
      dailyContractStats,
      dailyStat,
    });

    if (state.lastProcessedBlock !== undefined) {
      const network = this.configService.get<string>('app.neoNetwork') ?? 'MainNet';

      await this.prisma.ingestionCursor.upsert({
        where: { network },
        update: {
          lastProcessedBlock: state.lastProcessedBlock,
          lastProcessedTimestamp: state.lastProcessedTimestamp,
        },
        create: {
          network,
          lastProcessedBlock: state.lastProcessedBlock,
          lastProcessedTimestamp: state.lastProcessedTimestamp,
        },
      });
    }

    const rangeLabel =
      blockRange && blockRange.start <= blockRange.end
        ? ` (blocks ${blockRange.start}-${blockRange.end})`
        : '';
    this.logger.log(`Ingested ${state.totalTxCount} transactions for ${date}${rangeLabel}.`);
  }

  async isDayIngested(date: string): Promise<boolean> {
    const day = parseDate(date);
    const record = await this.prisma.dailyStat.findUnique({
      where: { date: day },
    });

    return Boolean(record);
  }

  async rebuildDay(date: string): Promise<void> {
    const day = parseDate(date);
    await this.prisma.dailyTx.deleteMany({ where: { date: day } });
    await this.prisma.dailyTransfer.deleteMany({ where: { date: day } });
    await this.prisma.dailyAssetStat.deleteMany({ where: { date: day } });
    await this.prisma.dailyMethodStat.deleteMany({ where: { date: day } });
    await this.prisma.dailyContractStat.deleteMany({ where: { date: day } });
    await this.prisma.dailyStat.deleteMany({ where: { date: day } });
    await this.ingestDay(date);
  }

  async backfillSwapUsdValues(
    from: string,
    to?: string,
  ): Promise<{ days: number; transactions: number; to: string | null }> {
    const start = parseDate(from);
    const end = to ? parseDate(to) : undefined;
    const days = await this.prisma.dailyStat.findMany({
      where: {
        date: {
          gte: start,
          ...(end ? { lte: end } : {}),
        },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
      },
    });
    let transactions = 0;

    for (const entry of days) {
      const date = formatDate(entry.date, 'UTC');
      this.logger.log(`Backfilling swap USD values for ${date}.`);
      transactions += await this.backfillSwapUsdValuesForDay(entry.date);
    }

    const lastDay = days[days.length - 1];

    return {
      days: days.length,
      transactions,
      to: lastDay ? formatDate(lastDay.date, 'UTC') : null,
    };
  }

  async ingestWindow(start: Date, end: Date): Promise<void> {
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    this.logger.log(`Starting ingestion window ${startIso} to ${endIso}.`);

    const { transactions, blockRange } = await this.fetchAllTransactionsForRange(start, end);
    const dateLabel = formatDate(start, 'UTC');
    const day = parseDate(dateLabel);
    const summary = await this.buildDailySummary(transactions, day, blockRange);

    await this.saveDailySummary(day, summary);

    const rangeLabel =
      blockRange && blockRange.start <= blockRange.end
        ? ` (blocks ${blockRange.start}-${blockRange.end})`
        : '';
    this.logger.log(
      `Ingested ${transactions.length} transactions for ${dateLabel} (${startIso} to ${endIso})${rangeLabel}.`,
    );
  }

  private async buildDailySummary(
    transactions: NeoTransaction[],
    day: Date,
    blockRange?: BlockRange,
  ): Promise<DailySummary> {
    const dailyTx: DailyTxRecord[] = [];
    const dailyTransfers: DailyTransferRecord[] = [];
    const assetMap = new Map<string, AssetAggregate>();
    const methodMap = new Map<string, MethodAggregate>();
    const contractMap = new Map<string, ContractAggregate>();
    const senders = new Set<string>();
    const receivers = new Set<string>();
    const addresses = new Set<string>();
    let swapsCount = 0;
    let swapsUsdValue = new Prisma.Decimal(0);
    let oracleCount = 0;
    let transfersCount = 0;
    let gasClaimsCount = 0;
    let othersCount = 0;
    let neoVolumeRaw = 0n;
    let gasVolumeRaw = 0n;
    let minBlockIndex: number | undefined;
    let maxBlockIndex: number | undefined;
    const pricingContext = await this.createSwapPricingContext();

    for (const transaction of transactions) {
      if (typeof transaction.blockIndex === 'number') {
        minBlockIndex =
          minBlockIndex === undefined
            ? transaction.blockIndex
            : Math.min(minBlockIndex, transaction.blockIndex);
        maxBlockIndex =
          maxBlockIndex === undefined
            ? transaction.blockIndex
            : Math.max(maxBlockIndex, transaction.blockIndex);
      }

      const transfers = transaction.transfers ?? [];
      const transferCount = transfers.length;
      const classification = classifyTransaction(transaction, {
        swapMethodAllowlist: defaultSwapMethods,
      });
      const primaryTransfer = this.getPrimaryTransfer(transfers);
      const primaryAsset = this.normalizeAsset(primaryTransfer?.asset);
      const primaryAmountRaw = this.toBigInt(primaryTransfer?.amount);
      const normalizedFrom = this.normalizeAddress(classification.from);
      const normalizedTo = this.normalizeAddress(classification.to);
      const method = this.normalizeMethod(transaction.invocation?.method);
      const contract = this.normalizeContract(transaction.invocation?.contract);
      const swapUsdValue =
        classification.type === ClassifiedType.SWAP
          ? await this.calculateSwapUsdValue(transfers, pricingContext)
          : null;

      dailyTx.push({
        date: day,
        txid: transaction.txid,
        type: classification.type,
        from: normalizedFrom,
        to: normalizedTo,
        asset: primaryAsset,
        amountRaw: primaryAmountRaw ?? undefined,
        swapUsdValue: swapUsdValue ? this.toUsdStorageValue(swapUsdValue) : undefined,
        transferCount,
        method,
        contract,
        timestamp: new Date(transaction.timestamp),
        blockIndex: transaction.blockIndex,
        rawJson: transaction.raw,
      });

      switch (classification.type) {
        case ClassifiedType.SWAP: {
          swapsCount += 1;
          swapsUsdValue = swapsUsdValue.add(swapUsdValue ?? 0);
          break;
        }
        case ClassifiedType.ORACLE: {
          oracleCount += 1;
          break;
        }
        case ClassifiedType.NORMAL_TRANSFER: {
          transfersCount += 1;
          break;
        }
        case ClassifiedType.GAS_CLAIM: {
          gasClaimsCount += 1;
          break;
        }
        default: {
          othersCount += 1;
          break;
        }
      }

      const assetsInTx = new Set<string>();
      transfers.forEach((transfer, index) => {
        const asset = this.normalizeAsset(transfer.asset);
        const amountRaw = this.toBigInt(transfer.amount);
        if (!asset || amountRaw === null) {
          return;
        }

        const from = this.normalizeAddress(transfer.from);
        const to = this.normalizeAddress(transfer.to);

        dailyTransfers.push({
          date: day,
          txid: transaction.txid,
          transferIndex: index,
          asset,
          amountRaw,
          from,
          to,
        });

        assetsInTx.add(asset);

        if (asset === 'NEO') {
          neoVolumeRaw += amountRaw;
        }

        if (asset === 'GAS') {
          gasVolumeRaw += amountRaw;
        }

        if (from && from !== '') {
          senders.add(from);
          addresses.add(from);
        }

        if (to && to !== '') {
          receivers.add(to);
          addresses.add(to);
        }

        const aggregate = assetMap.get(asset) ?? {
          transferCount: 0,
          txCount: 0,
          senders: new Set<string>(),
          receivers: new Set<string>(),
          volumeRaw: 0n,
        };
        aggregate.transferCount += 1;
        if (from && from !== '') {
          aggregate.senders.add(from);
        }
        if (to && to !== '') {
          aggregate.receivers.add(to);
        }
        aggregate.volumeRaw += amountRaw;
        assetMap.set(asset, aggregate);
      });

      for (const asset of assetsInTx) {
        const aggregate = assetMap.get(asset);
        if (!aggregate) {
          continue;
        }

        aggregate.txCount += 1;
      }

      if (method) {
        const key = method;
        const existing = methodMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          methodMap.set(key, { key, count: 1 });
        }
      }

      if (contract) {
        const key = contract;
        const existing = contractMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          contractMap.set(key, { key, count: 1 });
        }
      }
    }

    const dailyAssetStats: DailyAssetStatRecord[] = Array.from(assetMap.entries()).map(
      ([asset, aggregate]) => ({
        date: day,
        asset,
        transferCount: aggregate.transferCount,
        txCount: aggregate.txCount,
        uniqueSenders: aggregate.senders.size,
        uniqueReceivers: aggregate.receivers.size,
        volumeRaw: aggregate.volumeRaw,
      }),
    );

    const dailyMethodStats: DailyMethodStatRecord[] = Array.from(methodMap.values()).map(
      (stat) => ({
        date: day,
        method: stat.key,
        txCount: stat.count,
      }),
    );

    const dailyContractStats: DailyContractStatRecord[] = Array.from(contractMap.values()).map(
      (stat) => ({
        date: day,
        contract: stat.key,
        txCount: stat.count,
      }),
    );

    const blockCount = this.resolveBlockCount(blockRange, {
      minBlockIndex,
      maxBlockIndex,
    });
    const dailyStat: DailyStatRecord = {
      date: day,
      totalTxCount: transactions.length,
      swapsCount,
      swapsUsdValue: this.toUsdStorageValue(swapsUsdValue),
      oracleCount,
      transfersCount,
      gasClaimsCount,
      othersCount,
      realUsageTotal: transactions.length - gasClaimsCount,
      totalTransfers: dailyTransfers.length,
      uniqueSenders: senders.size,
      uniqueReceivers: receivers.size,
      uniqueAddresses: addresses.size,
      neoVolumeRaw,
      gasVolumeRaw,
      blockCount,
    };

    return {
      dailyTx,
      dailyTransfers,
      dailyAssetStats,
      dailyMethodStats,
      dailyContractStats,
      dailyStat,
    };
  }

  private async saveDailySummary(day: Date, summary: DailySummary): Promise<void> {
    const dailyTxData: DailyTxCreateRecord[] = summary.dailyTx.map((record) => ({
      ...record,
      amountRaw: record.amountRaw?.toString(),
      rawJson: this.toJsonValue(record.rawJson),
    }));
    const dailyTransfersData: DailyTransferCreateRecord[] = summary.dailyTransfers.map(
      (transfer) => ({
        ...transfer,
        amountRaw: transfer.amountRaw.toString(),
      }),
    );
    const dailyAssetStatsData: DailyAssetStatCreateRecord[] = summary.dailyAssetStats.map(
      (stat) => ({
        ...stat,
        volumeRaw: stat.volumeRaw.toString(),
      }),
    );
    const dailyStatData: DailyStatUpsertRecord = {
      ...summary.dailyStat,
      neoVolumeRaw: summary.dailyStat.neoVolumeRaw.toString(),
      gasVolumeRaw: summary.dailyStat.gasVolumeRaw.toString(),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyTx.deleteMany({ where: { date: day } });
      await tx.dailyTransfer.deleteMany({ where: { date: day } });
      await tx.dailyAssetStat.deleteMany({ where: { date: day } });
      await tx.dailyMethodStat.deleteMany({ where: { date: day } });
      await tx.dailyContractStat.deleteMany({ where: { date: day } });
      await tx.dailyStat.deleteMany({ where: { date: day } });

      if (dailyTxData.length > 0) {
        await tx.dailyTx.createMany({
          data: dailyTxData,
          skipDuplicates: true,
        });
      }

      if (dailyTransfersData.length > 0) {
        await tx.dailyTransfer.createMany({
          data: dailyTransfersData,
          skipDuplicates: true,
        });
      }

      if (dailyAssetStatsData.length > 0) {
        await tx.dailyAssetStat.createMany({ data: dailyAssetStatsData });
      }

      if (summary.dailyMethodStats.length > 0) {
        await tx.dailyMethodStat.createMany({ data: summary.dailyMethodStats });
      }

      if (summary.dailyContractStats.length > 0) {
        await tx.dailyContractStat.createMany({
          data: summary.dailyContractStats,
        });
      }

      await tx.dailyStat.upsert({
        where: { date: day },
        update: dailyStatData,
        create: dailyStatData,
      });
    });
  }

  private async saveAggregates(day: Date, summary: DailySummary): Promise<void> {
    const dailyAssetStatsData: DailyAssetStatCreateRecord[] = summary.dailyAssetStats.map(
      (stat) => ({
        ...stat,
        volumeRaw: stat.volumeRaw.toString(),
      }),
    );
    const dailyStatData: DailyStatUpsertRecord = {
      ...summary.dailyStat,
      neoVolumeRaw: summary.dailyStat.neoVolumeRaw.toString(),
      gasVolumeRaw: summary.dailyStat.gasVolumeRaw.toString(),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyAssetStat.deleteMany({ where: { date: day } });
      await tx.dailyMethodStat.deleteMany({ where: { date: day } });
      await tx.dailyContractStat.deleteMany({ where: { date: day } });
      await tx.dailyStat.deleteMany({ where: { date: day } });

      if (dailyAssetStatsData.length > 0) {
        await tx.dailyAssetStat.createMany({ data: dailyAssetStatsData });
      }

      if (summary.dailyMethodStats.length > 0) {
        await tx.dailyMethodStat.createMany({ data: summary.dailyMethodStats });
      }

      if (summary.dailyContractStats.length > 0) {
        await tx.dailyContractStat.createMany({
          data: summary.dailyContractStats,
        });
      }

      await tx.dailyStat.upsert({
        where: { date: day },
        update: dailyStatData,
        create: dailyStatData,
      });
    });
  }

  private async clearDay(day: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.dailyTx.deleteMany({ where: { date: day } });
      await tx.dailyTransfer.deleteMany({ where: { date: day } });
      await tx.dailyAssetStat.deleteMany({ where: { date: day } });
      await tx.dailyMethodStat.deleteMany({ where: { date: day } });
      await tx.dailyContractStat.deleteMany({ where: { date: day } });
      await tx.dailyStat.deleteMany({ where: { date: day } });
    });
  }

  private async backfillSwapUsdValuesForDay(day: Date): Promise<number> {
    const swapTransactions = await this.prisma.dailyTx.findMany({
      where: {
        date: day,
        type: 'SWAP',
      },
      orderBy: [{ txid: 'asc' }],
      select: {
        date: true,
        txid: true,
        swapUsdValue: true,
      },
    });

    if (swapTransactions.length === 0) {
      await this.prisma.dailyStat.update({
        where: { date: day },
        data: {
          swapsUsdValue: this.toUsdStorageValue(new Prisma.Decimal(0)),
        },
      });

      return 0;
    }

    const txids = swapTransactions.map((transaction) => transaction.txid);
    const transfers = await this.prisma.dailyTransfer.findMany({
      where: {
        date: day,
        txid: { in: txids },
      },
      orderBy: [{ txid: 'asc' }, { transferIndex: 'asc' }],
    });
    const pricingContext = await this.createSwapPricingContextForDay(day);
    const transfersByTx = this.groupTransfersForPricing(transfers);
    const updates: Array<{ txid: string; swapUsdValue: string }> = [];
    let total = new Prisma.Decimal(0);

    for (const transaction of swapTransactions) {
      const value = await this.calculateSwapUsdValue(
        transfersByTx.get(transaction.txid) ?? [],
        pricingContext,
      );
      const swapUsdValue = this.toUsdStorageValue(value);
      updates.push({
        txid: transaction.txid,
        swapUsdValue,
      });
      total = total.add(value);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.dailyTx.update({
          where: { txid: update.txid },
          data: {
            swapUsdValue: update.swapUsdValue,
          },
        });
      }

      await tx.dailyStat.update({
        where: { date: day },
        data: {
          swapsUsdValue: this.toUsdStorageValue(total),
        },
      });
    });

    return updates.length;
  }

  private async processTransactionBatch(
    transactions: NeoTransaction[],
    state: StreamState,
    pricingContext: SwapPricingContext,
  ): Promise<void> {
    for (const transaction of transactions) {
      state.totalTxCount += 1;

      if (typeof transaction.blockIndex === 'number') {
        state.minBlockIndex =
          state.minBlockIndex === undefined
            ? transaction.blockIndex
            : Math.min(state.minBlockIndex, transaction.blockIndex);
        state.maxBlockIndex =
          state.maxBlockIndex === undefined
            ? transaction.blockIndex
            : Math.max(state.maxBlockIndex, transaction.blockIndex);
        state.lastProcessedBlock = transaction.blockIndex;
      }

      state.lastProcessedTimestamp = new Date(transaction.timestamp);

      const transfers = transaction.transfers ?? [];
      const transferCount = transfers.length;
      const classification = classifyTransaction(transaction, {
        swapMethodAllowlist: defaultSwapMethods,
      });
      const primaryTransfer = this.getPrimaryTransfer(transfers);
      const primaryAsset = this.normalizeAsset(primaryTransfer?.asset);
      const primaryAmountRaw = this.toBigInt(primaryTransfer?.amount);
      const normalizedFrom = this.normalizeAddress(classification.from);
      const normalizedTo = this.normalizeAddress(classification.to);
      const method = this.normalizeMethod(transaction.invocation?.method);
      const contract = this.normalizeContract(transaction.invocation?.contract);
      const swapUsdValue =
        classification.type === ClassifiedType.SWAP
          ? await this.calculateSwapUsdValue(transfers, pricingContext)
          : null;

      state.txBuffer.push({
        date: state.day,
        txid: transaction.txid,
        type: classification.type,
        from: normalizedFrom,
        to: normalizedTo,
        asset: primaryAsset,
        amountRaw: primaryAmountRaw?.toString(),
        swapUsdValue: swapUsdValue ? this.toUsdStorageValue(swapUsdValue) : undefined,
        transferCount,
        method,
        contract,
        timestamp: new Date(transaction.timestamp),
        blockIndex: transaction.blockIndex,
        rawJson: this.toJsonValue(transaction.raw),
      });

      if (state.txBuffer.length >= this.txBatchSize) {
        await this.flushTxBuffer(state);
      }

      switch (classification.type) {
        case ClassifiedType.SWAP: {
          state.swapsCount += 1;
          state.swapsUsdValue = state.swapsUsdValue.add(swapUsdValue ?? 0);
          break;
        }
        case ClassifiedType.ORACLE: {
          state.oracleCount += 1;
          break;
        }
        case ClassifiedType.NORMAL_TRANSFER: {
          state.transfersCount += 1;
          break;
        }
        case ClassifiedType.GAS_CLAIM: {
          state.gasClaimsCount += 1;
          break;
        }
        default: {
          state.othersCount += 1;
          break;
        }
      }

      const assetsInTx = new Set<string>();

      for (let index = 0; index < transfers.length; index += 1) {
        const transfer = transfers[index];
        const asset = this.normalizeAsset(transfer.asset);
        const amountRaw = this.toBigInt(transfer.amount);
        if (!asset || amountRaw === null) {
          continue;
        }

        const from = this.normalizeAddress(transfer.from);
        const to = this.normalizeAddress(transfer.to);

        state.transferBuffer.push({
          date: state.day,
          txid: transaction.txid,
          transferIndex: index,
          asset,
          amountRaw: amountRaw.toString(),
          from,
          to,
        });
        state.totalTransfers += 1;
        assetsInTx.add(asset);

        if (state.transferBuffer.length >= this.transferBatchSize) {
          await this.flushTransferBuffer(state);
        }

        if (asset === 'NEO') {
          state.neoVolumeRaw += amountRaw;
        }

        if (asset === 'GAS') {
          state.gasVolumeRaw += amountRaw;
        }

        if (from && from !== '') {
          state.senders.add(from);
          state.addresses.add(from);
        }

        if (to && to !== '') {
          state.receivers.add(to);
          state.addresses.add(to);
        }

        const aggregate = state.assetMap.get(asset) ?? {
          transferCount: 0,
          txCount: 0,
          senders: new Set<string>(),
          receivers: new Set<string>(),
          volumeRaw: 0n,
        };
        aggregate.transferCount += 1;
        if (from && from !== '') {
          aggregate.senders.add(from);
        }
        if (to && to !== '') {
          aggregate.receivers.add(to);
        }
        aggregate.volumeRaw += amountRaw;
        state.assetMap.set(asset, aggregate);
      }

      for (const asset of assetsInTx) {
        const aggregate = state.assetMap.get(asset);
        if (!aggregate) {
          continue;
        }

        aggregate.txCount += 1;
      }

      if (method) {
        const existing = state.methodMap.get(method);
        if (existing) {
          existing.count += 1;
        } else {
          state.methodMap.set(method, { key: method, count: 1 });
        }
      }

      if (contract) {
        const existing = state.contractMap.get(contract);
        if (existing) {
          existing.count += 1;
        } else {
          state.contractMap.set(contract, { key: contract, count: 1 });
        }
      }
    }
  }

  private async flushBuffers(state: StreamState): Promise<void> {
    await this.flushTxBuffer(state);
    await this.flushTransferBuffer(state);
  }

  private async flushTxBuffer(state: StreamState): Promise<void> {
    if (state.txBuffer.length === 0) {
      return;
    }

    await this.prisma.dailyTx.createMany({
      data: state.txBuffer,
      skipDuplicates: true,
    });
    state.txBuffer.length = 0;
  }

  private async flushTransferBuffer(state: StreamState): Promise<void> {
    if (state.transferBuffer.length === 0) {
      return;
    }

    await this.prisma.dailyTransfer.createMany({
      data: state.transferBuffer,
      skipDuplicates: true,
    });
    state.transferBuffer.length = 0;
  }

  private async fetchAllTransactionsForRange(start: Date, end: Date): Promise<TransactionBatch> {
    if (!this.neoClient.fetchTransactionsForRange) {
      const fallbackDate = formatDate(start, 'UTC');
      this.logger.warn(
        `Neo client does not support range ingestion; falling back to full day ${fallbackDate}.`,
      );

      return this.fetchAllTransactionsForDay(fallbackDate);
    }

    const transactions: NeoTransaction[] = [];
    let cursor: string | undefined;
    let nextCursor: string | undefined;
    let blockRange: BlockRange | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForRange(start, end, cursor);
      transactions.push(...response.transactions);
      nextCursor = response.nextCursor;
      cursor = nextCursor;

      if (!blockRange && response.blockStart !== undefined && response.blockEnd !== undefined) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }
    } while (nextCursor);

    return { transactions, blockRange };
  }

  private async fetchAllTransactionsForDay(date: string): Promise<TransactionBatch> {
    const transactions: NeoTransaction[] = [];
    let cursor: string | undefined;
    let nextCursor: string | undefined;
    let blockRange: BlockRange | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForDay(date, cursor);
      transactions.push(...response.transactions);
      nextCursor = response.nextCursor;
      cursor = nextCursor;

      if (!blockRange && response.blockStart !== undefined && response.blockEnd !== undefined) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }
    } while (nextCursor);

    return { transactions, blockRange };
  }

  private getPrimaryTransfer(transfers: NeoTransfer[]): NeoTransfer | undefined {
    if (transfers.length === 0) {
      return undefined;
    }

    const primary = transfers.find(
      (transfer) => transfer.asset === 'NEO' || transfer.asset === 'GAS',
    );

    return primary ?? transfers[0];
  }

  private normalizeMethod(method?: string): string | undefined {
    if (!method) {
      return undefined;
    }

    const trimmed = method.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.toLowerCase();
  }

  private normalizeContract(contract?: string): string | undefined {
    if (!contract) {
      return undefined;
    }

    const trimmed = contract.trim();
    if (!trimmed) {
      return undefined;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('0x')) {
      return lower;
    }

    return `0x${lower}`;
  }

  private normalizeAsset(asset?: string): string | undefined {
    if (!asset) {
      return undefined;
    }

    const trimmed = asset.trim();
    if (!trimmed) {
      return undefined;
    }

    const upper = trimmed.toUpperCase();
    if (upper === 'NEO' || upper === 'GAS') {
      return upper;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('0x')) {
      return lower;
    }

    return `0x${lower}`;
  }

  private normalizeAddress(value?: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('0x')) {
      return lower;
    }

    return `0x${lower}`;
  }

  private toBigInt(value?: string): bigint | null {
    if (!value) {
      return null;
    }

    try {
      return BigInt(value);
    } catch (_error) {
      return null;
    }
  }

  private async createSwapPricingContext(): Promise<SwapPricingContext> {
    const usdPricesByAsset = await this.fetchSwapUsdPrices();

    return {
      usdPricesByAsset,
      decimalsByAsset: new Map<string, number | null>(),
    };
  }

  private async createSwapPricingContextForDay(day: Date): Promise<SwapPricingContext> {
    const usdPricesByAsset = await this.fetchSwapUsdPricesForTimestamp(day.getTime() + DAY_IN_MS);

    return {
      usdPricesByAsset,
      decimalsByAsset: new Map<string, number | null>(),
    };
  }

  private async fetchSwapUsdPrices(): Promise<Map<string, Prisma.Decimal>> {
    const endpoint = this.configService.get<string>('app.flamingoPriceApiUrl')?.trim();
    if (!endpoint) {
      return new Map();
    }

    return this.fetchSwapUsdPricesFromUrl(endpoint);
  }

  private async fetchSwapUsdPricesForTimestamp(
    timestamp: number,
  ): Promise<Map<string, Prisma.Decimal>> {
    const latestUrl = this.configService.get<string>('app.flamingoPriceApiUrl')?.trim();
    if (!latestUrl) {
      return new Map();
    }

    const historicalUrl = this.buildHistoricalSwapUsdPriceUrl(latestUrl, timestamp);
    if (!historicalUrl) {
      return new Map();
    }

    return this.fetchSwapUsdPricesFromUrl(historicalUrl);
  }

  private buildHistoricalSwapUsdPriceUrl(latestUrl: string, timestamp: number): string | null {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    if (latestUrl.endsWith('/latest')) {
      return `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${Math.floor(timestamp)}`;
    }

    return `${latestUrl}/from-timestamp/${Math.floor(timestamp)}`;
  }

  private async fetchSwapUsdPricesFromUrl(url: string): Promise<Map<string, Prisma.Decimal>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.flamingoPriceTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch swap USD prices (HTTP ${response.status}). Continuing without USD pricing.`,
        );

        return new Map();
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        this.logger.warn(
          'Swap USD prices response is not an array. Continuing without USD pricing.',
        );

        return new Map();
      }

      const prices = new Map<string, Prisma.Decimal>();
      for (const row of payload) {
        if (!this.isSwapPriceApiRow(row)) {
          continue;
        }

        const usdPrice = this.parseUsdPrice(row.usd_price);
        if (!usdPrice || usdPrice.lessThan(0)) {
          continue;
        }

        this.addSwapPriceEntries(prices, row, usdPrice);
      }

      return prices;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch swap USD prices (${reason}). Continuing without USD pricing.`,
      );

      return new Map();
    } finally {
      clearTimeout(timeout);
    }
  }

  private isSwapPriceApiRow(value: unknown): value is SwapPriceApiRow {
    if (!value || typeof value !== 'object') {
      return false;
    }

    return true;
  }

  private parseUsdPrice(value: unknown): Prisma.Decimal | null {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }

      return new Prisma.Decimal(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      try {
        return new Prisma.Decimal(trimmed);
      } catch (_error) {
        return null;
      }
    }

    return null;
  }

  private addSwapPriceEntries(
    prices: Map<string, Prisma.Decimal>,
    row: SwapPriceApiRow,
    usdPrice: Prisma.Decimal,
  ): void {
    if (typeof row.hash === 'string') {
      const normalizedHash = this.normalizeAsset(row.hash);
      if (normalizedHash) {
        prices.set(normalizedHash, usdPrice);
      }
    }

    const symbols = [row.symbol, row.unwrappedSymbol];
    for (const symbol of symbols) {
      if (typeof symbol !== 'string') {
        continue;
      }

      const trimmed = symbol.trim();
      if (!trimmed) {
        continue;
      }

      prices.set(trimmed.toUpperCase(), usdPrice);
    }
  }

  private async calculateSwapUsdValue(
    transfers: NeoTransfer[],
    pricingContext: SwapPricingContext,
  ): Promise<Prisma.Decimal> {
    let total = new Prisma.Decimal(0);

    for (const transfer of transfers) {
      const asset = this.normalizeAsset(transfer.asset);
      const amountRaw = this.toBigInt(transfer.amount);
      if (!asset || amountRaw === null || amountRaw <= 0n) {
        continue;
      }

      const price = this.resolveUsdPrice(asset, pricingContext.usdPricesByAsset);
      if (!price) {
        continue;
      }

      const decimals = await this.resolveAssetDecimalsForPricing(asset, pricingContext);
      if (decimals === null || decimals < 0) {
        continue;
      }

      const scaledAmount = this.scaleAmountRaw(amountRaw, decimals);
      total = total.add(scaledAmount.mul(price));
    }

    return total;
  }

  private groupTransfersForPricing(
    transfers: DailyTransferPricingRecord[],
  ): Map<string, NeoTransfer[]> {
    const transfersByTx = new Map<string, NeoTransfer[]>();

    for (const transfer of transfers) {
      const existing = transfersByTx.get(transfer.txid) ?? [];
      existing.push({
        asset: transfer.asset,
        amount: transfer.amountRaw.toString(),
        from: transfer.from ?? undefined,
        to: transfer.to ?? undefined,
      });
      transfersByTx.set(transfer.txid, existing);
    }

    return transfersByTx;
  }

  private resolveUsdPrice(
    asset: string,
    usdPricesByAsset: Map<string, Prisma.Decimal>,
  ): Prisma.Decimal | null {
    const direct = usdPricesByAsset.get(asset);
    if (direct) {
      return direct;
    }

    if (asset.startsWith('0x')) {
      return usdPricesByAsset.get(asset.toLowerCase()) ?? null;
    }

    return usdPricesByAsset.get(asset.toUpperCase()) ?? null;
  }

  private async resolveAssetDecimalsForPricing(
    asset: string,
    pricingContext: SwapPricingContext,
  ): Promise<number | null> {
    const cached = pricingContext.decimalsByAsset.get(asset);
    if (cached !== undefined) {
      return cached;
    }

    let resolved: number | null = null;
    if (asset === 'NEO') {
      resolved = 0;
    } else if (asset === 'GAS') {
      resolved = 8;
    } else if (this.neoClient.resolveAssetDecimals) {
      try {
        resolved = await this.neoClient.resolveAssetDecimals(asset);
      } catch (_error) {
        resolved = null;
      }
    }

    pricingContext.decimalsByAsset.set(asset, resolved);

    return resolved;
  }

  private scaleAmountRaw(amountRaw: bigint, decimals: number): Prisma.Decimal {
    const amount = new Prisma.Decimal(amountRaw.toString());
    if (decimals === 0) {
      return amount;
    }

    const divisor = new Prisma.Decimal(10).pow(decimals);

    return amount.div(divisor);
  }

  private toUsdStorageValue(value: Prisma.Decimal): string {
    const rounded = value.toDecimalPlaces(8);

    return rounded.toFixed(8);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    const serialized = this.serializeJsonValue(value, new WeakSet());
    if (serialized === null) {
      return {};
    }

    return serialized;
  }

  private serializeJsonValue(value: unknown, seen: WeakSet<object>): Prisma.InputJsonValue | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }

      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
      return `0x${value.toString('hex')}`;
    }

    if (value instanceof Uint8Array) {
      return `0x${Buffer.from(value).toString('hex')}`;
    }

    if (Array.isArray(value)) {
      const result: Array<Prisma.InputJsonValue | null> = [];
      for (const entry of value) {
        result.push(this.serializeJsonValue(entry, seen));
      }

      return result;
    }

    if (value instanceof Map) {
      const result: Array<Prisma.InputJsonValue | null> = [];
      for (const [key, mapValue] of value.entries()) {
        result.push([String(key), this.serializeJsonValue(mapValue, seen)]);
      }

      return result;
    }

    if (value instanceof Set) {
      const result: Array<Prisma.InputJsonValue | null> = [];
      for (const entry of value.values()) {
        result.push(this.serializeJsonValue(entry, seen));
      }

      return result;
    }

    if (typeof value !== 'object') {
      return String(value);
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const recordValue = value as Record<string, unknown>;
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, entry] of Object.entries(recordValue)) {
      if (entry === undefined) {
        continue;
      }

      result[key] = this.serializeJsonValue(entry, seen);
    }
    seen.delete(value);

    return result;
  }

  private resolveBlockCount(
    blockRange: BlockRange | undefined,
    state: BlockIndexState | undefined,
  ): number {
    if (blockRange) {
      return blockRange.end - blockRange.start + 1;
    }

    if (!state || state.minBlockIndex === undefined || state.maxBlockIndex === undefined) {
      return 0;
    }

    return state.maxBlockIndex - state.minBlockIndex + 1;
  }
}
