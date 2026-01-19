import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ClassifiedType,
  classifyTransaction,
  defaultSwapMethods,
} from "../classifier/classifier";
import { PrismaService } from "../common/prisma.service";
import {
  NeoClient,
  NeoTransaction,
  NeoTransfer,
} from "../neo-client/neo-client.interface";
import { NEO_CLIENT } from "../neo-client/neo-client.provider";
import { Prisma } from "@prisma/client";
import { formatDate, parseDate } from "./date-utils";
import {
  DailyAssetStatRecord,
  DailyAssetStatCreateRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatRecord,
  DailyStatUpsertRecord,
  DailyTransferRecord,
  DailyTransferCreateRecord,
  DailyTxRecord,
  DailyTxCreateRecord,
  IngestionPrismaClient,
} from "./ingestion.types";

type AssetAggregate = {
  transferCount: number;
  txCount: number;
  senders: Set<string>;
  receivers: Set<string>;
  volumeRaw: bigint;
};

type MethodAggregate = {
  key: string;
  count: number;
};

type ContractAggregate = {
  key: string;
  count: number;
};

type TransactionBatch = {
  transactions: NeoTransaction[];
  blockRange?: { start: number; end: number };
};

type DailySummary = {
  dailyTx: DailyTxRecord[];
  dailyTransfers: DailyTransferRecord[];
  dailyAssetStats: DailyAssetStatRecord[];
  dailyMethodStats: DailyMethodStatRecord[];
  dailyContractStats: DailyContractStatRecord[];
  dailyStat: DailyStatRecord;
};

type StreamState = {
  day: Date;
  txBuffer: DailyTxCreateRecord[];
  transferBuffer: DailyTransferCreateRecord[];
  assetMap: Map<string, AssetAggregate>;
  methodMap: Map<string, MethodAggregate>;
  contractMap: Map<string, ContractAggregate>;
  senders: Set<string>;
  receivers: Set<string>;
  addresses: Set<string>;
  swapsCount: number;
  transfersCount: number;
  gasClaimsCount: number;
  ignoredCount: number;
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  totalTxCount: number;
  totalTransfers: number;
  minBlockIndex?: number;
  maxBlockIndex?: number;
  lastProcessedBlock?: number;
  lastProcessedTimestamp?: Date;
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly txBatchSize = 1000;
  private readonly transferBatchSize = 5000;

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(PrismaService) private readonly prisma: IngestionPrismaClient,
    private readonly configService: ConfigService
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
      transfersCount: 0,
      gasClaimsCount: 0,
      ignoredCount: 0,
      neoVolumeRaw: 0n,
      gasVolumeRaw: 0n,
      totalTxCount: 0,
      totalTransfers: 0,
    };

    let cursor: string | undefined;
    let blockRange: { start: number; end: number } | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForDay(
        date,
        cursor
      );
      cursor = response.nextCursor;

      if (
        !blockRange &&
        response.blockStart !== undefined &&
        response.blockEnd !== undefined
      ) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }

      await this.processTransactionBatch(response.transactions, state);
    } while (cursor);

    await this.flushBuffers(state);

    const dailyAssetStats: DailyAssetStatRecord[] = Array.from(
      state.assetMap.entries()
    ).map(([asset, aggregate]) => ({
      date: day,
      asset,
      transferCount: aggregate.transferCount,
      txCount: aggregate.txCount,
      uniqueSenders: aggregate.senders.size,
      uniqueReceivers: aggregate.receivers.size,
      volumeRaw: aggregate.volumeRaw,
    }));

    const dailyMethodStats: DailyMethodStatRecord[] = Array.from(
      state.methodMap.values()
    ).map((stat) => ({
      date: day,
      method: stat.key,
      txCount: stat.count,
    }));

    const dailyContractStats: DailyContractStatRecord[] = Array.from(
      state.contractMap.values()
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
      transfersCount: state.transfersCount,
      gasClaimsCount: state.gasClaimsCount,
      ignoredCount: state.ignoredCount,
      realUsageTotal: state.swapsCount + state.transfersCount,
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
      const network =
        this.configService.get<string>("app.neoNetwork") ?? "MainNet";

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
        : "";
    this.logger.log(
      `Ingested ${state.totalTxCount} transactions for ${date}${rangeLabel}.`
    );
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

  async ingestWindow(start: Date, end: Date): Promise<void> {
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    this.logger.log(`Starting ingestion window ${startIso} to ${endIso}.`);

    const { transactions, blockRange } =
      await this.fetchAllTransactionsForRange(start, end);
    const dateLabel = formatDate(start, "UTC");
    const day = parseDate(dateLabel);
    const summary = this.buildDailySummary(transactions, day, blockRange);

    await this.saveDailySummary(day, summary);

    const rangeLabel =
      blockRange && blockRange.start <= blockRange.end
        ? ` (blocks ${blockRange.start}-${blockRange.end})`
        : "";
    this.logger.log(
      `Ingested ${transactions.length} transactions for ${dateLabel} (${startIso} to ${endIso})${rangeLabel}.`
    );
  }

  private buildDailySummary(
    transactions: NeoTransaction[],
    day: Date,
    blockRange?: { start: number; end: number }
  ): DailySummary {
    const dailyTx: DailyTxRecord[] = [];
    const dailyTransfers: DailyTransferRecord[] = [];
    const assetMap = new Map<string, AssetAggregate>();
    const methodMap = new Map<string, MethodAggregate>();
    const contractMap = new Map<string, ContractAggregate>();
    const senders = new Set<string>();
    const receivers = new Set<string>();
    const addresses = new Set<string>();
    let swapsCount = 0;
    let transfersCount = 0;
    let gasClaimsCount = 0;
    let ignoredCount = 0;
    let neoVolumeRaw = 0n;
    let gasVolumeRaw = 0n;
    let minBlockIndex: number | undefined;
    let maxBlockIndex: number | undefined;

    for (const transaction of transactions) {
      if (typeof transaction.blockIndex === "number") {
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

      dailyTx.push({
        date: day,
        txid: transaction.txid,
        type: classification.type,
        from: normalizedFrom,
        to: normalizedTo,
        asset: primaryAsset,
        amountRaw: primaryAmountRaw ?? undefined,
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
          ignoredCount += 1;
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

        if (asset === "NEO") {
          neoVolumeRaw += amountRaw;
        }

        if (asset === "GAS") {
          gasVolumeRaw += amountRaw;
        }

        if (from && from !== "") {
          senders.add(from);
          addresses.add(from);
        }

        if (to && to !== "") {
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
        if (from && from !== "") {
          aggregate.senders.add(from);
        }
        if (to && to !== "") {
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

    const dailyAssetStats: DailyAssetStatRecord[] = Array.from(
      assetMap.entries()
    ).map(([asset, aggregate]) => ({
      date: day,
      asset,
      transferCount: aggregate.transferCount,
      txCount: aggregate.txCount,
      uniqueSenders: aggregate.senders.size,
      uniqueReceivers: aggregate.receivers.size,
      volumeRaw: aggregate.volumeRaw,
    }));

    const dailyMethodStats: DailyMethodStatRecord[] = Array.from(
      methodMap.values()
    ).map((stat) => ({
      date: day,
      method: stat.key,
      txCount: stat.count,
    }));

    const dailyContractStats: DailyContractStatRecord[] = Array.from(
      contractMap.values()
    ).map((stat) => ({
      date: day,
      contract: stat.key,
      txCount: stat.count,
    }));

    const blockCount = this.resolveBlockCount(blockRange, {
      minBlockIndex,
      maxBlockIndex,
    });
    const dailyStat: DailyStatRecord = {
      date: day,
      totalTxCount: transactions.length,
      swapsCount,
      transfersCount,
      gasClaimsCount,
      ignoredCount,
      realUsageTotal: swapsCount + transfersCount,
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

  private async saveDailySummary(
    day: Date,
    summary: DailySummary
  ): Promise<void> {
    const dailyTxData: DailyTxCreateRecord[] = summary.dailyTx.map(
      (record) => ({
        ...record,
        amountRaw: record.amountRaw?.toString(),
        rawJson: this.toJsonValue(record.rawJson),
      })
    );
    const dailyTransfersData: DailyTransferCreateRecord[] =
      summary.dailyTransfers.map((transfer) => ({
        ...transfer,
        amountRaw: transfer.amountRaw.toString(),
      }));
    const dailyAssetStatsData: DailyAssetStatCreateRecord[] =
      summary.dailyAssetStats.map((stat) => ({
        ...stat,
        volumeRaw: stat.volumeRaw.toString(),
      }));
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

  private async saveAggregates(
    day: Date,
    summary: DailySummary
  ): Promise<void> {
    const dailyAssetStatsData: DailyAssetStatCreateRecord[] =
      summary.dailyAssetStats.map((stat) => ({
        ...stat,
        volumeRaw: stat.volumeRaw.toString(),
      }));
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

  private async processTransactionBatch(
    transactions: NeoTransaction[],
    state: StreamState
  ): Promise<void> {
    for (const transaction of transactions) {
      state.totalTxCount += 1;

      if (typeof transaction.blockIndex === "number") {
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

      state.txBuffer.push({
        date: state.day,
        txid: transaction.txid,
        type: classification.type,
        from: normalizedFrom,
        to: normalizedTo,
        asset: primaryAsset,
        amountRaw: primaryAmountRaw?.toString(),
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
          state.ignoredCount += 1;
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

        if (asset === "NEO") {
          state.neoVolumeRaw += amountRaw;
        }

        if (asset === "GAS") {
          state.gasVolumeRaw += amountRaw;
        }

        if (from && from !== "") {
          state.senders.add(from);
          state.addresses.add(from);
        }

        if (to && to !== "") {
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
        if (from && from !== "") {
          aggregate.senders.add(from);
        }
        if (to && to !== "") {
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

  private async fetchAllTransactionsForRange(
    start: Date,
    end: Date
  ): Promise<TransactionBatch> {
    if (!this.neoClient.fetchTransactionsForRange) {
      const fallbackDate = formatDate(start, "UTC");
      this.logger.warn(
        `Neo client does not support range ingestion; falling back to full day ${fallbackDate}.`
      );

      return this.fetchAllTransactionsForDay(fallbackDate);
    }

    const transactions: NeoTransaction[] = [];
    let cursor: string | undefined;
    let nextCursor: string | undefined;
    let blockRange: { start: number; end: number } | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForRange(
        start,
        end,
        cursor
      );
      transactions.push(...response.transactions);
      nextCursor = response.nextCursor;
      cursor = nextCursor;

      if (
        !blockRange &&
        response.blockStart !== undefined &&
        response.blockEnd !== undefined
      ) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }
    } while (nextCursor);

    return { transactions, blockRange };
  }

  private async fetchAllTransactionsForDay(
    date: string
  ): Promise<TransactionBatch> {
    const transactions: NeoTransaction[] = [];
    let cursor: string | undefined;
    let nextCursor: string | undefined;
    let blockRange: { start: number; end: number } | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForDay(
        date,
        cursor
      );
      transactions.push(...response.transactions);
      nextCursor = response.nextCursor;
      cursor = nextCursor;

      if (
        !blockRange &&
        response.blockStart !== undefined &&
        response.blockEnd !== undefined
      ) {
        blockRange = { start: response.blockStart, end: response.blockEnd };
      }
    } while (nextCursor);

    return { transactions, blockRange };
  }

  private getPrimaryTransfer(
    transfers: NeoTransfer[]
  ): NeoTransfer | undefined {
    if (transfers.length === 0) {
      return undefined;
    }

    const primary = transfers.find(
      (transfer) => transfer.asset === "NEO" || transfer.asset === "GAS"
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
    if (lower.startsWith("0x")) {
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
    if (upper === "NEO" || upper === "GAS") {
      return upper;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith("0x")) {
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
      return "";
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith("0x")) {
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
    } catch (error) {
      return null;
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    const serialized = this.serializeJsonValue(value, new WeakSet());
    if (serialized === null) {
      return {};
    }

    return serialized;
  }

  private serializeJsonValue(
    value: unknown,
    seen: WeakSet<object>
  ): Prisma.InputJsonValue | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string" || typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }

      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
      return `0x${value.toString("hex")}`;
    }

    if (value instanceof Uint8Array) {
      return `0x${Buffer.from(value).toString("hex")}`;
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

    if (typeof value !== "object") {
      return String(value);
    }

    if (seen.has(value)) {
      return "[Circular]";
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
    blockRange: { start: number; end: number } | undefined,
    state: { minBlockIndex?: number; maxBlockIndex?: number } | undefined
  ): number {
    if (blockRange) {
      return blockRange.end - blockRange.start + 1;
    }

    if (
      !state ||
      state.minBlockIndex === undefined ||
      state.maxBlockIndex === undefined
    ) {
      return 0;
    }

    return state.maxBlockIndex - state.minBlockIndex + 1;
  }
}
