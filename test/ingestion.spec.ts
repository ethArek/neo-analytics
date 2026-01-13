import { IngestionService } from '../src/ingestion/ingestion.service';
import { NeoClient } from '../src/neo-client/neo-client.interface';
import { ConfigService } from '@nestjs/config';

type DailyTx = {
  date: Date;
  txid: string;
  type: string;
  from?: string;
  to?: string;
  timestamp: Date;
  rawJson: Record<string, unknown>;
};

class FakePrismaService {
  dailyTxData: DailyTx[] = [];
  dailyStatData: Record<string, any> = {};
  ingestionCursorData: Record<string, any> = {};

  dailyTx = {
    createMany: async ({ data }: { data: DailyTx[] }) => {
      for (const item of data) {
        if (!this.dailyTxData.find((tx) => tx.txid === item.txid)) {
          this.dailyTxData.push(item);
        }
      }
    },
    count: async ({ where }: { where: { date: Date; type: string } }) =>
      this.dailyTxData.filter(
        (tx) => tx.date.getTime() === where.date.getTime() && tx.type === where.type,
      ).length,
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyTxData = this.dailyTxData.filter((tx) => tx.date.getTime() !== where.date.getTime());
    },
  };

  dailyStat = {
    upsert: async ({ where, update, create }: any) => {
      const key = where.date.toISOString();
      this.dailyStatData[key] = { ...create, ...update };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      delete this.dailyStatData[where.date.toISOString()];
    },
  };

  ingestionCursor = {
    upsert: async ({ where, update, create }: any) => {
      const key = where.network;
      this.ingestionCursorData[key] = { ...create, ...update };
    },
  };

  $transaction = async (callback: (tx: this) => Promise<void>) => callback(this);
}

describe('IngestionService', () => {
  it('ingests transactions and aggregates stats', async () => {
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({
        transactions: [
          {
            txid: 'swap-1',
            timestamp: new Date().toISOString(),
            blockIndex: 1,
            invocation: { contract: '0xanycontract', method: 'swap' },
            transfers: [
              { from: 'a', to: 'b', asset: 'NEO', amount: '1' },
              { from: 'b', to: 'a', asset: 'GAS', amount: '10' },
            ],
            raw: {},
          },
          {
            txid: 'transfer-1',
            timestamp: new Date().toISOString(),
            blockIndex: 2,
            transfers: [{ from: 'a', to: 'b', asset: 'GAS', amount: '2' }],
            raw: {},
          },
        ],
      }),
    };

    const prisma = new FakePrismaService();
    const configService = new ConfigService({
      app: {
        neoNetwork: 'MainNet',
      },
    });

    const service = new IngestionService(neoClient, prisma as any, configService);
    await service.ingestDay('2024-05-01');

    expect(prisma.dailyTxData).toHaveLength(2);
    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 1)).toISOString()];
    expect(stat.swapsCount).toBe(1);
    expect(stat.transfersCount).toBe(1);
    expect(stat.realUsageTotal).toBe(2);
  });
});
