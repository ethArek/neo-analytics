import { NeoXHistoryService } from './neo-x-history.service';
import type { NeoXNetworkStats, NeoXTransactionChartPoint } from './neo-x.service.types';

type NeoXDailyStatRow = {
  date: Date;
  txCount: number;
  transactionsToday: number | null;
  totalAddresses: number | null;
  totalBlocks: number | null;
  totalTransactions: number | null;
  averageBlockTimeMs: number | null;
  averageGasPriceGwei: number | null;
  gasUsedToday: string | null;
};

class PrismaServiceStub {
  readonly rows: NeoXDailyStatRow[] = [];

  readonly neoXDailyStat = {
    findMany: async (args?: {
      orderBy?: { date: 'asc' | 'desc' };
      select?: { date?: boolean; txCount?: boolean };
    }) => {
      const ordered = [...this.rows].sort((left, right) => {
        return left.date.getTime() - right.date.getTime();
      });

      if (args?.orderBy?.date === 'desc') {
        ordered.reverse();
      }

      if (args?.select) {
        return ordered.map((row) => ({
          date: row.date,
          txCount: row.txCount,
        }));
      }

      return ordered;
    },
    findFirst: async (args?: {
      where?: {
        OR?: Array<Record<string, { not: null }>>;
      };
      orderBy?: { date: 'asc' | 'desc' };
    }) => {
      const filtered =
        args?.where?.OR && args.where.OR.length > 0
          ? this.rows.filter((row) => {
              return (
                row.transactionsToday !== null ||
                row.totalAddresses !== null ||
                row.totalBlocks !== null ||
                row.totalTransactions !== null ||
                row.averageBlockTimeMs !== null ||
                row.averageGasPriceGwei !== null ||
                row.gasUsedToday !== null
              );
            })
          : [...this.rows];
      const ordered = filtered.sort((left, right) => {
        return left.date.getTime() - right.date.getTime();
      });

      if (args?.orderBy?.date === 'desc') {
        ordered.reverse();
      }

      return ordered[0] ?? null;
    },
    upsert: async (args: {
      where: { date: Date };
      update: Partial<NeoXDailyStatRow>;
      create: NeoXDailyStatRow;
    }) => {
      const existing = this.rows.find((row) => {
        return row.date.getTime() === args.where.date.getTime();
      });

      if (!existing) {
        this.rows.push({
          ...args.create,
        });

        return args.create;
      }

      for (const [key, value] of Object.entries(args.update)) {
        if (value !== undefined) {
          existing[key as keyof NeoXDailyStatRow] = value as never;
        }
      }

      return existing;
    },
  };

  async $transaction<T>(operations: Array<Promise<T>>): Promise<T[]> {
    return Promise.all(operations);
  }
}

class NeoXServiceStub {
  async getNetworkStats(): Promise<NeoXNetworkStats | null> {
    return null;
  }

  async getTransactionChart(): Promise<NeoXTransactionChartPoint[]> {
    return [];
  }
}

describe('NeoXHistoryService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists explorer chart rows and latest network snapshot', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-02T12:00:00.000Z'));
    const prisma = new PrismaServiceStub();
    prisma.rows.push({
      date: new Date('2026-02-28T00:00:00.000Z'),
      txCount: 95,
      transactionsToday: null,
      totalAddresses: null,
      totalBlocks: null,
      totalTransactions: null,
      averageBlockTimeMs: null,
      averageGasPriceGwei: null,
      gasUsedToday: null,
    });
    const neoXService = new NeoXServiceStub();
    const networkStats: NeoXNetworkStats = {
      averageBlockTimeMs: 8747,
      averageGasPriceGwei: 39.21,
      gasUsedToday: '59289564',
      totalAddresses: 17512,
      totalBlocks: 6161602,
      totalTransactions: 153583,
      transactionsToday: 406,
    };
    const transactionChart: NeoXTransactionChartPoint[] = [
      {
        date: '2026-03-01',
        txCount: 311,
      },
      {
        date: '2026-03-02',
        txCount: 350,
      },
    ];
    jest.spyOn(neoXService, 'getNetworkStats').mockResolvedValue(networkStats);
    jest.spyOn(neoXService, 'getTransactionChart').mockResolvedValue(transactionChart);
    const service = Reflect.construct(NeoXHistoryService, [
      neoXService,
      prisma,
    ]) as NeoXHistoryService;

    const result = await service.getDashboardHistory();

    expect(result.networkStats).toEqual(networkStats);
    expect(result.transactionChart).toEqual([
      {
        date: '2026-02-28',
        txCount: 95,
      },
      {
        date: '2026-03-01',
        txCount: 311,
      },
      {
        date: '2026-03-02',
        txCount: 406,
      },
    ]);
    expect(prisma.rows).toEqual([
      {
        date: new Date('2026-02-28T00:00:00.000Z'),
        txCount: 95,
        transactionsToday: null,
        totalAddresses: null,
        totalBlocks: null,
        totalTransactions: null,
        averageBlockTimeMs: null,
        averageGasPriceGwei: null,
        gasUsedToday: null,
      },
      {
        date: new Date('2026-03-01T00:00:00.000Z'),
        txCount: 311,
        transactionsToday: null,
        totalAddresses: null,
        totalBlocks: null,
        totalTransactions: null,
        averageBlockTimeMs: null,
        averageGasPriceGwei: null,
        gasUsedToday: null,
      },
      {
        date: new Date('2026-03-02T00:00:00.000Z'),
        txCount: 406,
        transactionsToday: 406,
        totalAddresses: 17512,
        totalBlocks: 6161602,
        totalTransactions: 153583,
        averageBlockTimeMs: 8747,
        averageGasPriceGwei: 39.21,
        gasUsedToday: '59289564',
      },
    ]);
  });

  it('falls back to persisted Neo X history when explorer data is unavailable', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-03T12:00:00.000Z'));
    const prisma = new PrismaServiceStub();
    prisma.rows.push(
      {
        date: new Date('2026-03-01T00:00:00.000Z'),
        txCount: 311,
        transactionsToday: null,
        totalAddresses: null,
        totalBlocks: null,
        totalTransactions: null,
        averageBlockTimeMs: null,
        averageGasPriceGwei: null,
        gasUsedToday: null,
      },
      {
        date: new Date('2026-03-02T00:00:00.000Z'),
        txCount: 406,
        transactionsToday: 406,
        totalAddresses: 17512,
        totalBlocks: 6161602,
        totalTransactions: 153583,
        averageBlockTimeMs: 8747,
        averageGasPriceGwei: 39.21,
        gasUsedToday: '59289564',
      },
    );
    const neoXService = new NeoXServiceStub();
    jest.spyOn(neoXService, 'getNetworkStats').mockResolvedValue(null);
    jest.spyOn(neoXService, 'getTransactionChart').mockResolvedValue([]);
    const service = Reflect.construct(NeoXHistoryService, [
      neoXService,
      prisma,
    ]) as NeoXHistoryService;

    const result = await service.getDashboardHistory();

    expect(result.networkStats).toEqual({
      averageBlockTimeMs: 8747,
      averageGasPriceGwei: 39.21,
      gasUsedToday: '59289564',
      totalAddresses: 17512,
      totalBlocks: 6161602,
      totalTransactions: 153583,
      transactionsToday: 406,
    });
    expect(result.transactionChart).toEqual([
      {
        date: '2026-03-01',
        txCount: 311,
      },
      {
        date: '2026-03-02',
        txCount: 406,
      },
    ]);
  });

  it('returns the persisted range after a manual Neo X sync', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-11T12:00:00.000Z'));
    const prisma = new PrismaServiceStub();
    const neoXService = new NeoXServiceStub();
    jest.spyOn(neoXService, 'getNetworkStats').mockResolvedValue({
      averageBlockTimeMs: null,
      averageGasPriceGwei: null,
      gasUsedToday: null,
      totalAddresses: null,
      totalBlocks: null,
      totalTransactions: null,
      transactionsToday: 222,
    });
    jest.spyOn(neoXService, 'getTransactionChart').mockResolvedValue([
      {
        date: '2026-03-10',
        txCount: 200,
      },
      {
        date: '2026-03-11',
        txCount: 210,
      },
    ]);
    const service = Reflect.construct(NeoXHistoryService, [
      neoXService,
      prisma,
    ]) as NeoXHistoryService;

    const result = await service.syncRecentHistory();

    expect(result).toEqual({
      availableFrom: '2026-03-10',
      availableTo: '2026-03-11',
      persistedDays: 2,
    });
    expect(prisma.rows).toHaveLength(2);
    expect(prisma.rows[1]?.txCount).toBe(222);
  });
});
