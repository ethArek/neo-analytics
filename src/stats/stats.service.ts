import { u, wallet } from '@cityofzion/neon-js';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { decimalToBigInt } from '../common/prisma-decimal';
import { parseDate } from '../ingestion/date-utils';
import type {
  AggregatedAssetStat,
  AggregatedCount,
  DailyAssetStatWithBigInt,
  DailyStatRow,
  DailyStatWithBigInt,
  DailyTxWithBigInt,
  DayDetailsOptions,
  DayDetailsPagination,
  StatsRange,
  TopAddress,
  UniqueAddressStats,
} from './stats.service.types';

@Injectable()
export class StatsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLatestStats(limit = 30): Promise<DailyStatWithBigInt[]> {
    const stats = await this.prisma.dailyStat.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    });

    return stats.map((stat) => this.mapDailyStat(stat));
  }

  async getStatsRange(from: string, to: string): Promise<DailyStatWithBigInt[]> {
    const stats = await this.prisma.dailyStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
      orderBy: { date: 'asc' },
    });

    return stats.map((stat) => this.mapDailyStat(stat));
  }

  async getRangeOrLatest(from?: string, to?: string, limit = 30): Promise<StatsRange> {
    if (from && to) {
      const stats = await this.getStatsRange(from, to);
      return { stats, range: { from: parseDate(from), to: parseDate(to) } };
    }

    const latest = await this.getLatestStats(limit);
    const ordered = [...latest].sort((a, b) => a.date.getTime() - b.date.getTime());
    const rangeFrom = ordered[0]?.date;
    const rangeTo = ordered[ordered.length - 1]?.date;

    if (!rangeFrom || !rangeTo) {
      return { stats: ordered };
    }

    return { stats: ordered, range: { from: rangeFrom, to: rangeTo } };
  }

  async getAssetStatsRange(from: string, to: string): Promise<AggregatedAssetStat[]> {
    const dateRange = {
      gte: parseDate(from),
      lte: parseDate(to),
    };
    const [grouped, uniqueSenders, uniqueReceivers] = await Promise.all([
      this.prisma.dailyAssetStat.groupBy({
        by: ['asset'],
        where: { date: dateRange },
        _sum: {
          transferCount: true,
          txCount: true,
          volumeRaw: true,
        },
      }),
      this.prisma.dailyTransfer.groupBy({
        by: ['asset', 'from'],
        where: {
          date: dateRange,
          from: { not: null, notIn: [''] },
        },
      }),
      this.prisma.dailyTransfer.groupBy({
        by: ['asset', 'to'],
        where: {
          date: dateRange,
          to: { not: null, notIn: [''] },
        },
      }),
    ]);
    const senderCountByAsset = new Map<string, number>();
    for (const row of uniqueSenders) {
      const current = senderCountByAsset.get(row.asset) ?? 0;
      senderCountByAsset.set(row.asset, current + 1);
    }

    const receiverCountByAsset = new Map<string, number>();
    for (const row of uniqueReceivers) {
      const current = receiverCountByAsset.get(row.asset) ?? 0;
      receiverCountByAsset.set(row.asset, current + 1);
    }

    const aggregated = grouped.map((row) => ({
      asset: row.asset,
      transferCount: row._sum.transferCount ?? 0,
      txCount: row._sum.txCount ?? 0,
      uniqueSenders: senderCountByAsset.get(row.asset) ?? 0,
      uniqueReceivers: receiverCountByAsset.get(row.asset) ?? 0,
      volumeRaw: decimalToBigInt(row._sum.volumeRaw),
    }));

    return aggregated.sort((a, b) => {
      if (a.volumeRaw === b.volumeRaw) {
        return 0;
      }

      return a.volumeRaw > b.volumeRaw ? -1 : 1;
    });
  }

  async getMethodStatsRange(from: string, to: string): Promise<AggregatedCount[]> {
    const records = await this.prisma.dailyMethodStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
    });
    const methodMap = new Map<string, number>();

    for (const record of records) {
      const key = record.method;
      const current = methodMap.get(key) ?? 0;
      methodMap.set(key, current + record.txCount);
    }

    return this.sortCounts(methodMap);
  }

  async getContractStatsRange(from: string, to: string): Promise<AggregatedCount[]> {
    const records = await this.prisma.dailyContractStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
    });
    const contractMap = new Map<string, number>();

    for (const record of records) {
      const key = record.contract;
      const current = contractMap.get(key) ?? 0;
      contractMap.set(key, current + record.txCount);
    }

    return this.sortCounts(contractMap);
  }

  async getTopAddresses(
    from: string,
    to: string,
    direction: 'from' | 'to',
    limit = 8,
  ): Promise<TopAddress[]> {
    const dateRange = {
      gte: parseDate(from),
      lte: parseDate(to),
    };

    if (direction === 'from') {
      const grouped = await this.prisma.dailyTransfer.groupBy({
        by: ['from'],
        where: {
          date: dateRange,
          from: { not: null, notIn: [''] },
        },
        _sum: { amountRaw: true },
        _count: { from: true },
        orderBy: { _count: { from: 'desc' } },
        take: limit,
      });

      return grouped.map((row) => ({
        address: this.toN3Address(row.from ?? ''),
        transferCount: row._count.from ?? 0,
        volumeRaw: decimalToBigInt(row._sum.amountRaw),
      }));
    }

    const grouped = await this.prisma.dailyTransfer.groupBy({
      by: ['to'],
      where: {
        date: dateRange,
        to: { not: null, notIn: [''] },
      },
      _sum: { amountRaw: true },
      _count: { to: true },
      orderBy: { _count: { to: 'desc' } },
      take: limit,
    });

    return grouped.map((row) => ({
      address: this.toN3Address(row.to ?? ''),
      transferCount: row._count.to ?? 0,
      volumeRaw: decimalToBigInt(row._sum.amountRaw),
    }));
  }

  async getUniqueAddressStatsRange(from: string, to: string): Promise<UniqueAddressStats> {
    const [senders, receivers] = await Promise.all([
      this.prisma.dailyTransfer.groupBy({
        by: ['from'],
        where: {
          date: {
            gte: parseDate(from),
            lte: parseDate(to),
          },
          from: { not: null, notIn: [''] },
        },
      }),
      this.prisma.dailyTransfer.groupBy({
        by: ['to'],
        where: {
          date: {
            gte: parseDate(from),
            lte: parseDate(to),
          },
          to: { not: null, notIn: [''] },
        },
      }),
    ]);
    const senderSet = new Set(senders.map((row) => row.from).filter(Boolean));
    const receiverSet = new Set(receivers.map((row) => row.to).filter(Boolean));
    const uniqueAddresses = new Set([...senderSet, ...receiverSet]);

    return {
      uniqueSenders: senderSet.size,
      uniqueReceivers: receiverSet.size,
      uniqueAddresses: uniqueAddresses.size,
    };
  }

  async getDayDetails(
    date: string,
    options: DayDetailsOptions = {
      page: 1,
      pageSize: 50,
    },
  ) {
    const day = parseDate(date);
    const safePage = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
    const safePageSize = Number.isFinite(options.pageSize)
      ? Math.max(1, Math.floor(options.pageSize))
      : 50;
    const [stat, totalItems, assetStats, methodStats, contractStats] = await Promise.all([
      this.prisma.dailyStat.findUnique({ where: { date: day } }),
      this.prisma.dailyTx.count({ where: { date: day } }),
      this.prisma.dailyAssetStat.findMany({ where: { date: day } }),
      this.prisma.dailyMethodStat.findMany({ where: { date: day } }),
      this.prisma.dailyContractStat.findMany({ where: { date: day } }),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const page = Math.min(safePage, totalPages);
    const skip = (page - 1) * safePageSize;
    const transactions = await this.prisma.dailyTx.findMany({
      where: { date: day },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      skip,
      take: safePageSize,
    });

    const normalizedStat = stat ? this.mapDailyStat(stat) : null;
    const normalizedTransactions: DailyTxWithBigInt[] = transactions.map((transaction) => ({
      ...transaction,
      amountRaw: transaction.amountRaw === null ? null : decimalToBigInt(transaction.amountRaw),
      swapUsdValue: transaction.swapUsdValue === null ? null : transaction.swapUsdValue.toString(),
    }));
    const normalizedAssetStats: DailyAssetStatWithBigInt[] = assetStats.map((assetStat) => ({
      ...assetStat,
      volumeRaw: decimalToBigInt(assetStat.volumeRaw),
    }));

    return {
      stat: normalizedStat,
      transactions: normalizedTransactions,
      assetStats: normalizedAssetStats,
      methodStats,
      contractStats,
      pagination: {
        page,
        pageSize: safePageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      } satisfies DayDetailsPagination,
    };
  }

  private sortCounts(map: Map<string, number>): AggregatedCount[] {
    const entries = Array.from(map.entries()).map(([key, count]) => ({
      key,
      count,
    }));

    return entries.sort((a, b) => b.count - a.count);
  }

  private toN3Address(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    if (!this.isScriptHash(trimmed)) {
      return value;
    }

    const scriptHash = trimmed.slice(2);
    const reversed = u.reverseHex(scriptHash);
    const converted =
      this.safeGetAddressFromScriptHash(reversed) ?? this.safeGetAddressFromScriptHash(scriptHash);
    if (!converted) {
      return value;
    }

    return converted;
  }

  private safeGetAddressFromScriptHash(scriptHash: string): string | null {
    try {
      return wallet.getAddressFromScriptHash(scriptHash);
    } catch (_error) {
      return null;
    }
  }

  private isScriptHash(value: string): boolean {
    return /^0x[0-9a-f]{40}$/i.test(value);
  }

  private mapDailyStat(stat: DailyStatRow): DailyStatWithBigInt {
    return {
      ...stat,
      realUsageTotal: Math.max(0, stat.totalTxCount - stat.gasClaimsCount),
      neoVolumeRaw: decimalToBigInt(stat.neoVolumeRaw),
      gasVolumeRaw: decimalToBigInt(stat.gasVolumeRaw),
      swapsUsdValue: stat.swapsUsdValue.toString(),
    };
  }
}
