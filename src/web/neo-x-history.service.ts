import { Inject, Injectable, Logger } from '@nestjs/common';
import { TtlCache } from '../common/cache.utils';
import { PrismaService } from '../common/prisma.service';
import { formatDate, parseDate } from '../ingestion/date-utils';
import { NeoXService } from './neo-x.service';
import type {
  NeoXDashboardHistory,
  NeoXHistorySyncResult,
  NeoXNetworkStats,
  NeoXTransactionChartPoint,
} from './neo-x.service.types';

const DASHBOARD_HISTORY_CACHE_TTL_MS = 15 * 1000;

type CachedValue<T> = {
  value: T;
  cacheable: boolean;
};

type PersistedDailyStatWrite = {
  date: string;
  txCount: number;
  transactionsToday?: number | null;
  totalAddresses?: number | null;
  totalBlocks?: number | null;
  totalTransactions?: number | null;
  averageBlockTimeMs?: number | null;
  averageGasPriceGwei?: number | null;
  gasUsedToday?: string | null;
};

@Injectable()
export class NeoXHistoryService {
  private readonly logger = new Logger(NeoXHistoryService.name);
  private readonly dashboardCache = new TtlCache<NeoXDashboardHistory>();

  constructor(
    @Inject(NeoXService) private readonly neoXService: NeoXService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getDashboardHistory(): Promise<NeoXDashboardHistory> {
    return this.getCachedValue(
      this.dashboardCache,
      async () => {
        const [liveNetworkStats, liveTransactionChart] = await Promise.all([
          this.neoXService.getNetworkStats(),
          this.neoXService.getTransactionChart(),
        ]);

        await this.persistRecentHistory(liveTransactionChart, liveNetworkStats);

        const [persistedNetworkStats, persistedTransactionChart] = await Promise.all([
          this.getLatestPersistedNetworkStats(),
          this.getPersistedTransactionChart(),
        ]);

        return {
          value: {
            networkStats: liveNetworkStats ?? persistedNetworkStats,
            transactionChart: persistedTransactionChart,
          },
          cacheable: true,
        };
      },
      DASHBOARD_HISTORY_CACHE_TTL_MS,
    );
  }

  async syncRecentHistory(): Promise<NeoXHistorySyncResult> {
    const [liveNetworkStats, liveTransactionChart] = await Promise.all([
      this.neoXService.getNetworkStats(),
      this.neoXService.getTransactionChart(),
    ]);

    await this.persistRecentHistory(liveTransactionChart, liveNetworkStats);
    this.dashboardCache.clear();

    const persistedTransactionChart = await this.getPersistedTransactionChart();

    return {
      availableFrom: persistedTransactionChart[0]?.date ?? null,
      availableTo: persistedTransactionChart[persistedTransactionChart.length - 1]?.date ?? null,
      persistedDays: persistedTransactionChart.length,
    };
  }

  private async persistRecentHistory(
    transactionChart: NeoXTransactionChartPoint[],
    networkStats: NeoXNetworkStats | null,
  ): Promise<void> {
    const writes = this.buildPersistedDailyWrites(transactionChart, networkStats);
    if (writes.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      writes.map((record) => {
        const date = parseDate(record.date);
        const update: {
          txCount: number;
          transactionsToday?: number | null;
          totalAddresses?: number | null;
          totalBlocks?: number | null;
          totalTransactions?: number | null;
          averageBlockTimeMs?: number | null;
          averageGasPriceGwei?: number | null;
          gasUsedToday?: string | null;
        } = {
          txCount: record.txCount,
        };

        if (record.transactionsToday !== undefined) {
          update.transactionsToday = record.transactionsToday;
        }

        if (record.totalAddresses !== undefined) {
          update.totalAddresses = record.totalAddresses;
        }

        if (record.totalBlocks !== undefined) {
          update.totalBlocks = record.totalBlocks;
        }

        if (record.totalTransactions !== undefined) {
          update.totalTransactions = record.totalTransactions;
        }

        if (record.averageBlockTimeMs !== undefined) {
          update.averageBlockTimeMs = record.averageBlockTimeMs;
        }

        if (record.averageGasPriceGwei !== undefined) {
          update.averageGasPriceGwei = record.averageGasPriceGwei;
        }

        if (record.gasUsedToday !== undefined) {
          update.gasUsedToday = record.gasUsedToday;
        }

        return this.prisma.neoXDailyStat.upsert({
          where: { date },
          update,
          create: {
            date,
            txCount: record.txCount,
            transactionsToday: record.transactionsToday ?? null,
            totalAddresses: record.totalAddresses ?? null,
            totalBlocks: record.totalBlocks ?? null,
            totalTransactions: record.totalTransactions ?? null,
            averageBlockTimeMs: record.averageBlockTimeMs ?? null,
            averageGasPriceGwei: record.averageGasPriceGwei ?? null,
            gasUsedToday: record.gasUsedToday ?? null,
          },
        });
      }),
    );

    this.dashboardCache.clear();
  }

  private buildPersistedDailyWrites(
    transactionChart: NeoXTransactionChartPoint[],
    networkStats: NeoXNetworkStats | null,
  ): PersistedDailyStatWrite[] {
    const records = new Map<string, PersistedDailyStatWrite>();

    for (const point of transactionChart) {
      records.set(point.date, {
        date: point.date,
        txCount: point.txCount,
      });
    }

    if (networkStats) {
      const latestDate = formatDate(new Date(), 'UTC');
      const current = records.get(latestDate);
      const txCount = networkStats.transactionsToday ?? current?.txCount;

      if (txCount !== null && txCount !== undefined) {
        records.set(latestDate, {
          date: latestDate,
          txCount,
          transactionsToday: networkStats.transactionsToday,
          totalAddresses: networkStats.totalAddresses,
          totalBlocks: networkStats.totalBlocks,
          totalTransactions: networkStats.totalTransactions,
          averageBlockTimeMs: networkStats.averageBlockTimeMs,
          averageGasPriceGwei: networkStats.averageGasPriceGwei,
          gasUsedToday: networkStats.gasUsedToday,
        });
      }
    }

    return [...records.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  private async getPersistedTransactionChart(): Promise<NeoXTransactionChartPoint[]> {
    const rows = await this.prisma.neoXDailyStat.findMany({
      orderBy: { date: 'asc' },
      select: {
        date: true,
        txCount: true,
      },
    });

    return rows.map((row) => ({
      date: formatDate(row.date, 'UTC'),
      txCount: row.txCount,
    }));
  }

  private async getLatestPersistedNetworkStats(): Promise<NeoXNetworkStats | null> {
    const row = await this.prisma.neoXDailyStat.findFirst({
      where: {
        OR: [
          { transactionsToday: { not: null } },
          { totalAddresses: { not: null } },
          { totalBlocks: { not: null } },
          { totalTransactions: { not: null } },
          { averageBlockTimeMs: { not: null } },
          { averageGasPriceGwei: { not: null } },
          { gasUsedToday: { not: null } },
        ],
      },
      orderBy: { date: 'desc' },
    });

    if (!row) {
      return null;
    }

    return {
      averageBlockTimeMs: this.toNullableNumber(row.averageBlockTimeMs),
      averageGasPriceGwei: this.toNullableNumber(row.averageGasPriceGwei),
      gasUsedToday: row.gasUsedToday?.toString() ?? null,
      totalAddresses: row.totalAddresses,
      totalBlocks: row.totalBlocks,
      totalTransactions: row.totalTransactions,
      transactionsToday: row.transactionsToday,
    };
  }

  private toNullableNumber(value: { toString(): string } | number | null): number | null {
    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed;
  }

  private async getCachedValue<T>(
    cache: TtlCache<T>,
    loader: () => Promise<CachedValue<T>>,
    ttlMs: number,
  ): Promise<T> {
    const cached = cache.get();
    if (cached.kind === 'hit') {
      return cached.value;
    }

    const existingPromise = cache.getPromise();
    if (existingPromise) {
      return existingPromise;
    }

    const request = (async () => {
      const result = await loader();
      if (result.cacheable) {
        cache.set(result.value, ttlMs);
      }

      return result.value;
    })();
    cache.setPromise(request);

    try {
      return await request;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to build Neo X dashboard history (${reason}).`);
      throw error;
    } finally {
      cache.setPromise(null);
    }
  }
}
