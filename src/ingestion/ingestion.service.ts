import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassifiedType, classifyTransaction, defaultSwapMethods } from '../classifier/classifier';
import { PrismaService } from '../common/prisma.service';
import { NeoClient, NeoTransaction, NeoTransfer } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { formatDate, parseDate } from './date-utils';
import {
  DailyAssetStatRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatRecord,
  DailyTransferRecord,
  DailyTxRecord,
  IngestionPrismaClient,
} from './ingestion.types';

type AssetAggregate = {
  transferCount: number;
  txIds: Set<string>;
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

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(PrismaService) private readonly prisma: IngestionPrismaClient,
    private readonly configService: ConfigService,
  ) {}

  async ingestDay(date: string): Promise<void> {
    this.logger.log(`Starting ingestion for ${date}.`);

    const { transactions, blockRange } = await this.fetchAllTransactionsForDay(date);
    const day = parseDate(date);
    const summary = this.buildDailySummary(transactions, day, blockRange);

    await this.saveDailySummary(day, summary);

    const last = transactions[transactions.length - 1];
    if (last?.blockIndex) {
      const network = this.configService.get<string>('app.neoNetwork') ?? 'MainNet';

      await this.prisma.ingestionCursor.upsert({
        where: { network },
        update: {
          lastProcessedBlock: last.blockIndex,
          lastProcessedTimestamp: new Date(last.timestamp),
        },
        create: {
          network,
          lastProcessedBlock: last.blockIndex,
          lastProcessedTimestamp: new Date(last.timestamp),
        },
      });
    }

    const rangeLabel =
      blockRange && blockRange.start <= blockRange.end
        ? ` (blocks ${blockRange.start}-${blockRange.end})`
        : '';
    this.logger.log(
      `Ingested ${transactions.length} transactions for ${date}${rangeLabel} (swaps ${summary.dailyStat.swapsCount}, transfers ${summary.dailyStat.transfersCount}, gas claims ${summary.dailyStat.gasClaimsCount}, ignored ${summary.dailyStat.ignoredCount}).`,
    );
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

    const { transactions, blockRange } = await this.fetchAllTransactionsForRange(start, end);
    const dateLabel = formatDate(start, 'UTC');
    const day = parseDate(dateLabel);
    const summary = this.buildDailySummary(transactions, day, blockRange);

    await this.saveDailySummary(day, summary);

    const rangeLabel =
      blockRange && blockRange.start <= blockRange.end
        ? ` (blocks ${blockRange.start}-${blockRange.end})`
        : '';
    this.logger.log(
      `Ingested ${transactions.length} transactions for ${dateLabel} (${startIso} to ${endIso})${rangeLabel} (swaps ${summary.dailyStat.swapsCount}, transfers ${summary.dailyStat.transfersCount}, gas claims ${summary.dailyStat.gasClaimsCount}, ignored ${summary.dailyStat.ignoredCount}).`,
    );
  }

  private buildDailySummary(
    transactions: NeoTransaction[],
    day: Date,
    blockRange?: { start: number; end: number },
  ): DailySummary {
    const dailyTx: DailyTxRecord[] = [];
    const dailyTransfers: DailyTransferRecord[] = [];
    const assetMap = new Map<string, AssetAggregate>();
    const methodMap = new Map<string, MethodAggregate>();
    const contractMap = new Map<string, ContractAggregate>();
    const senders = new Set<string>();
    const receivers = new Set<string>();
    let swapsCount = 0;
    let transfersCount = 0;
    let gasClaimsCount = 0;
    let ignoredCount = 0;
    let neoVolumeRaw = 0n;
    let gasVolumeRaw = 0n;

    for (const transaction of transactions) {
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
        amountRaw: primaryAmountRaw !== null ? primaryAmountRaw.toString() : undefined,
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
          amountRaw: amountRaw.toString(),
          from,
          to,
        });

        if (asset === 'NEO') {
          neoVolumeRaw += amountRaw;
        }

        if (asset === 'GAS') {
          gasVolumeRaw += amountRaw;
        }

        if (from && from !== '') {
          senders.add(from);
        }

        if (to && to !== '') {
          receivers.add(to);
        }

        const aggregate = assetMap.get(asset) ?? {
          transferCount: 0,
          txIds: new Set<string>(),
          senders: new Set<string>(),
          receivers: new Set<string>(),
          volumeRaw: 0n,
        };
        aggregate.transferCount += 1;
        aggregate.txIds.add(transaction.txid);
        if (from && from !== '') {
          aggregate.senders.add(from);
        }
        if (to && to !== '') {
          aggregate.receivers.add(to);
        }
        aggregate.volumeRaw += amountRaw;
        assetMap.set(asset, aggregate);
      });

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
        txCount: aggregate.txIds.size,
        uniqueSenders: aggregate.senders.size,
        uniqueReceivers: aggregate.receivers.size,
        volumeRaw: aggregate.volumeRaw.toString(),
      }),
    );

    const dailyMethodStats: DailyMethodStatRecord[] = Array.from(methodMap.values()).map((stat) => ({
      date: day,
      method: stat.key,
      txCount: stat.count,
    }));

    const dailyContractStats: DailyContractStatRecord[] = Array.from(contractMap.values()).map(
      (stat) => ({
        date: day,
        contract: stat.key,
        txCount: stat.count,
      }),
    );

    const uniqueAddresses = new Set<string>([...senders, ...receivers]);
    const blockCount = this.resolveBlockCount(blockRange, transactions);
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
      uniqueAddresses: uniqueAddresses.size,
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
    await this.prisma.$transaction(async (tx) => {
      await tx.dailyTx.deleteMany({ where: { date: day } });
      await tx.dailyTransfer.deleteMany({ where: { date: day } });
      await tx.dailyAssetStat.deleteMany({ where: { date: day } });
      await tx.dailyMethodStat.deleteMany({ where: { date: day } });
      await tx.dailyContractStat.deleteMany({ where: { date: day } });
      await tx.dailyStat.deleteMany({ where: { date: day } });

      if (summary.dailyTx.length > 0) {
        await tx.dailyTx.createMany({ data: summary.dailyTx, skipDuplicates: true });
      }

      if (summary.dailyTransfers.length > 0) {
        await tx.dailyTransfer.createMany({ data: summary.dailyTransfers, skipDuplicates: true });
      }

      if (summary.dailyAssetStats.length > 0) {
        await tx.dailyAssetStat.createMany({ data: summary.dailyAssetStats });
      }

      if (summary.dailyMethodStats.length > 0) {
        await tx.dailyMethodStat.createMany({ data: summary.dailyMethodStats });
      }

      if (summary.dailyContractStats.length > 0) {
        await tx.dailyContractStat.createMany({ data: summary.dailyContractStats });
      }

      await tx.dailyStat.upsert({
        where: { date: day },
        update: summary.dailyStat,
        create: summary.dailyStat,
      });
    });
  }

  private async fetchAllTransactionsForRange(
    start: Date,
    end: Date,
  ): Promise<TransactionBatch> {
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
    let blockRange: { start: number; end: number } | undefined;

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
    let blockRange: { start: number; end: number } | undefined;

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

    const primary = transfers.find((transfer) => transfer.asset === 'NEO' || transfer.asset === 'GAS');

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
    } catch (error) {

      return null;
    }
  }

  private resolveBlockCount(
    blockRange: { start: number; end: number } | undefined,
    transactions: NeoTransaction[],
  ): number {
    if (blockRange) {

      return blockRange.end - blockRange.start + 1;
    }

    const indices = transactions
      .map((transaction) => transaction.blockIndex)
      .filter((index): index is number => typeof index === 'number');
    if (indices.length === 0) {

      return 0;
    }

    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);

    return maxIndex - minIndex + 1;
  }
}
