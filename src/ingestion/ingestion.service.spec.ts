import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { IngestionService } from './ingestion.service';

class NeoClientStub {
  async fetchTransactionsForDay(_date: string): Promise<{
    transactions: [];
  }> {
    return {
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
};

class PrismaStub {
  dailyTxRows: DailyTxRow[] = [
    {
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
    },
  ];

  dailyTx = {
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
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
    deleteMany: async () => ({ count: 0 }),
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
    upsert: async () => {
      throw new Error('Not implemented in test.');
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
    deleteMany: async () => ({ count: 0 }),
  };

  ingestionCursor = {
    upsert: async () => {
      throw new Error('Not implemented in test.');
    },
  };

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
    const service = Reflect.construct(IngestionService, [
      new NeoClientStub(),
      prisma,
      new ConfigService({
        app: {
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
    expect(prisma.dailyTxRows[0]?.swapUsdValue).toBe('3.00000000');
    expect(prisma.dailyStatRows[0]?.swapsUsdValue).toBe('3.00000000');
  });
});
