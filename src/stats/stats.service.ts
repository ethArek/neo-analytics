import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { parseDate } from '../ingestion/date-utils';

export type AggregatedAssetStat = {
  asset: string;
  transferCount: number;
  txCount: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  volumeRaw: bigint;
};

export type AggregatedCount = {
  key: string;
  count: number;
};

export type TopAddress = {
  address: string;
  transferCount: number;
  volumeRaw: bigint;
};

export type UniqueAddressStats = {
  uniqueSenders: number;
  uniqueReceivers: number;
  uniqueAddresses: number;
};

export type StatsRange = {
  stats: Awaited<ReturnType<PrismaService['dailyStat']['findMany']>>;
  range?: { from: Date; to: Date };
};

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestStats(limit = 30) {
    return this.prisma.dailyStat.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getStatsRange(from: string, to: string) {
    return this.prisma.dailyStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
      orderBy: { date: 'asc' },
    });
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
    const records = await this.prisma.dailyAssetStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
    });
    const assetMap = new Map<string, AggregatedAssetStat>();

    for (const record of records) {
      const existing = assetMap.get(record.asset);
      if (!existing) {
        assetMap.set(record.asset, {
          asset: record.asset,
          transferCount: record.transferCount,
          txCount: record.txCount,
          uniqueSenders: record.uniqueSenders,
          uniqueReceivers: record.uniqueReceivers,
          volumeRaw: record.volumeRaw,
        });
        continue;
      }

      existing.transferCount += record.transferCount;
      existing.txCount += record.txCount;
      existing.uniqueSenders += record.uniqueSenders;
      existing.uniqueReceivers += record.uniqueReceivers;
      existing.volumeRaw += record.volumeRaw;
    }

    return Array.from(assetMap.values()).sort((a, b) => {
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
        address: row.from ?? '',
        transferCount: row._count.from ?? 0,
        volumeRaw: row._sum.amountRaw ?? 0n,
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
      address: row.to ?? '',
      transferCount: row._count.to ?? 0,
      volumeRaw: row._sum.amountRaw ?? 0n,
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

  async getDayDetails(date: string) {
    const day = parseDate(date);
    const [stat, transactions, assetStats, methodStats, contractStats] = await Promise.all([
      this.prisma.dailyStat.findUnique({ where: { date: day } }),
      this.prisma.dailyTx.findMany({
        where: { date: day },
        orderBy: { timestamp: 'asc' },
      }),
      this.prisma.dailyAssetStat.findMany({ where: { date: day } }),
      this.prisma.dailyMethodStat.findMany({ where: { date: day } }),
      this.prisma.dailyContractStat.findMany({ where: { date: day } }),
    ]);

    return { stat, transactions, assetStats, methodStats, contractStats };
  }

  private sortCounts(map: Map<string, number>): AggregatedCount[] {
    const entries = Array.from(map.entries()).map(([key, count]) => ({ key, count }));

    return entries.sort((a, b) => b.count - a.count);
  }
}
