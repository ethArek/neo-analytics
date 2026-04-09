import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { IngestionService } from './ingestion.service';

class NeoClientStub {
  fetchedDays: string[] = [];

  async fetchTransactionsForDay(_date: string): Promise<{
    nextCursor?: string;
    transactions: [];
  }> {
    this.fetchedDays.push(_date);

    return {
      nextCursor: undefined,
      transactions: [],
    };
  }

  async resolveAssetDecimals(asset: string): Promise<number | null> {
    if (asset === '0xtoken') {
      return 8;
    }

    return null;
  }
}

type DailyTxRow = {
  asset: string | null;
  amountRaw: string | null;
  date: Date;
  txid: string;
  swapUsdValue: string | null;
};

type DailyTransferRow = {
  date: Date;
  txid: string;
  transferIndex: number;
  asset: string;
  amountRaw: Prisma.Decimal;
  from: string | null;
  to: string | null;
};

type DailyStatRow = {
  date: Date;
  swapsUsdValue: string;
  oracleCount: number;
};

class PrismaStub {
  executeRawCalls = 0;
  locks = new Map<string, { expiresAt: Date; holder: string }>();

  dailyTxRows: DailyTxRow[] = [
    {
      asset: null,
      amountRaw: null,
      date: new Date('2026-03-01T00:00:00.000Z'),
      txid: 'tx-1',
      swapUsdValue: null,
    },
  ];

  dailyTransferRows: DailyTransferRow[] = [
    {
      date: new Date('2026-03-01T00:00:00.000Z'),
      txid: 'tx-1',
      transferIndex: 0,
      asset: '0xtoken',
      amountRaw: new Prisma.Decimal('200000000'),
      from: '0xfrom',
      to: '0xto',
    },
  ];

  dailyStatRows: DailyStatRow[] = [
    {
      date: new Date('2026-03-01T00:00:00.000Z'),
      swapsUsdValue: '0.00000000',
      oracleCount: 0,
    },
  ];

  dailyTx = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async (args: { where: { date: Date } }) => {
      this.dailyTxRows = this.dailyTxRows.filter(
        (row) => row.date.getTime() !== args.where.date.getTime(),
      );

      return { count: 0 };
    },
    findMany: async (args: {
      where: {
        date: Date;
        type?: 'SWAP';
      };
    }) => {
      return this.dailyTxRows
        .filter((row) => row.date.getTime() === args.where.date.getTime())
        .map((row) => ({
          date: row.date,
          txid: row.txid,
          swapUsdValue: row.swapUsdValue === null ? null : new Prisma.Decimal(row.swapUsdValue),
        }));
    },
    update: async (args: { where: { txid: string }; data: { swapUsdValue: string } }) => {
      const row = this.dailyTxRows.find((entry) => entry.txid === args.where.txid);
      if (row) {
        row.swapUsdValue = args.data.swapUsdValue;
      }

      return {
        id: 1,
        date: new Date('2026-03-01T00:00:00.000Z'),
        txid: args.where.txid,
        type: 'SWAP',
        from: null,
        to: null,
        asset: null,
        amountRaw: null,
        swapUsdValue: new Prisma.Decimal(args.data.swapUsdValue),
        transferCount: 1,
        method: null,
        contract: null,
        timestamp: new Date('2026-03-01T00:00:00.000Z'),
        blockIndex: null,
        rawJson: {},
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      };
    },
  };

  dailyTransfer = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async (args: { where: { date: Date } }) => {
      this.dailyTransferRows = this.dailyTransferRows.filter(
        (row) => row.date.getTime() !== args.where.date.getTime(),
      );

      return { count: 0 };
    },
    findMany: async (args: {
      where: {
        date: Date;
        txid?: { in: string[] };
      };
    }) => {
      return this.dailyTransferRows.filter((row) => {
        if (row.date.getTime() !== args.where.date.getTime()) {
          return false;
        }

        if (!args.where.txid) {
          return true;
        }

        return args.where.txid.in.includes(row.txid);
      });
    },
  };

  dailyAssetStat = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  };

  dailyMethodStat = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  };

  dailyContractStat = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  };

  dailyStat = {
    findUnique: async () => null,
    findMany: async (args: {
      where: {
        date: {
          gte: Date;
          lte?: Date;
        };
      };
    }) => {
      return this.dailyStatRows
        .filter((row) => {
          if (row.date < args.where.date.gte) {
            return false;
          }

          if (args.where.date.lte && row.date > args.where.date.lte) {
            return false;
          }

          return true;
        })
        .map((row) => ({ date: row.date }));
    },
    upsert: async (args: {
      where: { date: Date };
      update: {
        swapsUsdValue: string;
        oracleCount?: number;
      };
      create: {
        swapsUsdValue: string;
        oracleCount?: number;
      };
    }) => {
      const existing = this.dailyStatRows.find(
        (entry) => entry.date.getTime() === args.where.date.getTime(),
      );
      if (existing) {
        existing.swapsUsdValue = args.update.swapsUsdValue;
        existing.oracleCount = args.update.oracleCount ?? existing.oracleCount;
      } else {
        this.dailyStatRows.push({
          date: args.where.date,
          swapsUsdValue: args.create.swapsUsdValue,
          oracleCount: args.create.oracleCount ?? 0,
        });
      }

      return {
        id: 1,
        date: args.where.date,
        totalTxCount: 0,
        swapsCount: 0,
        swapsUsdValue: new Prisma.Decimal(args.create.swapsUsdValue),
        oracleCount: args.create.oracleCount ?? 0,
        transfersCount: 0,
        gasClaimsCount: 0,
        othersCount: 0,
        realUsageTotal: 0,
        totalTransfers: 0,
        uniqueSenders: 0,
        uniqueReceivers: 0,
        uniqueAddresses: 0,
        neoVolumeRaw: new Prisma.Decimal(0),
        gasVolumeRaw: new Prisma.Decimal(0),
        blockCount: 0,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      };
    },
    update: async (args: { where: { date: Date }; data: { swapsUsdValue: string } }) => {
      const row = this.dailyStatRows.find(
        (entry) => entry.date.getTime() === args.where.date.getTime(),
      );
      if (row) {
        row.swapsUsdValue = args.data.swapsUsdValue;
      }

      return {
        id: 1,
        date: args.where.date,
        totalTxCount: 1,
        swapsCount: 1,
        swapsUsdValue: new Prisma.Decimal(args.data.swapsUsdValue),
        oracleCount: 0,
        transfersCount: 0,
        gasClaimsCount: 0,
        othersCount: 0,
        realUsageTotal: 1,
        totalTransfers: 1,
        uniqueSenders: 1,
        uniqueReceivers: 1,
        uniqueAddresses: 2,
        neoVolumeRaw: new Prisma.Decimal(0),
        gasVolumeRaw: new Prisma.Decimal(0),
        blockCount: 1,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      };
    },
    deleteMany: async (args: { where: { date: Date } }) => {
      this.dailyStatRows = this.dailyStatRows.filter(
        (row) => row.date.getTime() !== args.where.date.getTime(),
      );

      return { count: 0 };
    },
  };

  ingestionCursor = {
    upsert: async () => {
      throw new Error('Not implemented in test.');
    },
  };

  ingestionLock = {
    createMany: async (args: {
      data: Array<{
        lockKey: string;
        holder: string;
        expiresAt: Date;
      }>;
      skipDuplicates?: boolean;
    }) => {
      let count = 0;
      for (const entry of args.data) {
        if (this.locks.has(entry.lockKey)) {
          continue;
        }

        this.locks.set(entry.lockKey, {
          expiresAt: entry.expiresAt,
          holder: entry.holder,
        });
        count += 1;
      }

      return { count };
    },
    deleteMany: async (args: {
      where: {
        lockKey?: string;
        holder?: string;
        expiresAt?: {
          lte: Date;
        };
      };
    }) => {
      let count = 0;
      for (const [lockKey, lock] of [...this.locks.entries()]) {
        if (args.where.lockKey && lockKey !== args.where.lockKey) {
          continue;
        }

        if (args.where.holder && lock.holder !== args.where.holder) {
          continue;
        }

        if (args.where.expiresAt && lock.expiresAt > args.where.expiresAt.lte) {
          continue;
        }

        this.locks.delete(lockKey);
        count += 1;
      }

      return { count };
    },
  };

  async $executeRaw(query: Prisma.Sql): Promise<number> {
    this.executeRawCalls += 1;

    const values = (query as Prisma.Sql & { values?: unknown[] }).values ?? [];
    for (let index = 0; index < values.length; index += 4) {
      const txid = values[index];
      const swapUsdValue = values[index + 1];
      const asset = values[index + 2];
      const amountRaw = values[index + 3];
      if (typeof txid !== 'string' || typeof swapUsdValue !== 'string') {
        continue;
      }

      const row = this.dailyTxRows.find((entry) => entry.txid === txid);
      if (row) {
        row.swapUsdValue = swapUsdValue;
        row.asset = typeof asset === 'string' ? asset : null;
        row.amountRaw = typeof amountRaw === 'string' ? amountRaw : null;
      }
    }

    return Math.floor(values.length / 4);
  }

  async $transaction<T>(callback: (tx: PrismaStub) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe('IngestionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('backfills swap usd values for ingested days using Flamingo historical pricing', async () => {
    const prisma = new PrismaStub();
    const neoClient = new NeoClientStub();
    const service = Reflect.construct(IngestionService, [
      neoClient,
      prisma,
      new ConfigService({
        app: {
          neoNetwork: 'MainNet',
          flamingoPriceApiUrl: 'https://example.test/flamingo/live-data/prices/latest',
        },
      }),
    ]) as IngestionService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            symbol: 'TOKEN',
            unwrappedSymbol: 'TOKEN',
            hash: '0xtoken',
            usd_price: '1.50',
          },
        ]),
        { status: 200 },
      ),
    );

    const result = await service.backfillSwapUsdValues('2026-03-01');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.test/flamingo/live-data/prices/from-timestamp/1772409600000',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
        },
      }),
    );
    expect(result).toEqual({
      days: 1,
      transactions: 1,
      to: '2026-03-01',
    });
    expect(prisma.executeRawCalls).toBe(1);
    expect(prisma.dailyTxRows[0]?.swapUsdValue).toBe('3.00000000');
    expect(prisma.dailyTxRows[0]?.asset).toBe('0xtoken');
    expect(prisma.dailyTxRows[0]?.amountRaw).toBe('200000000');
    expect(prisma.dailyStatRows[0]?.swapsUsdValue).toBe('3.00000000');
  });

  it('repairs full UTC days touched by a 10-minute window', async () => {
    const prisma = new PrismaStub();
    const neoClient = new NeoClientStub();
    const service = Reflect.construct(IngestionService, [
      neoClient,
      prisma,
      new ConfigService({
        app: {
          neoNetwork: 'MainNet',
        },
      }),
    ]) as IngestionService;

    await service.ingestWindow(
      new Date('2026-03-01T23:55:00.000Z'),
      new Date('2026-03-02T00:05:00.000Z'),
    );

    expect(neoClient.fetchedDays).toEqual(['2026-03-01', '2026-03-02']);
  });
});
