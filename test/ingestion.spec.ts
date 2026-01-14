import { ConfigService } from '@nestjs/config';
import { IngestionService } from '../src/ingestion/ingestion.service';
import {
  DailyAssetStatRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatRecord,
  DailyTransferRecord,
  DailyTxRecord,
  IngestionPrismaClient,
} from '../src/ingestion/ingestion.types';
import { NeoClient } from '../src/neo-client/neo-client.interface';

class FakePrismaService implements IngestionPrismaClient {
  dailyTxData: DailyTxRecord[] = [];
  dailyTransferData: DailyTransferRecord[] = [];
  dailyAssetStatData: DailyAssetStatRecord[] = [];
  dailyMethodStatData: DailyMethodStatRecord[] = [];
  dailyContractStatData: DailyContractStatRecord[] = [];
  dailyStatData: Record<string, DailyStatRecord> = {};
  ingestionCursorData: Record<string, { lastProcessedBlock?: number; lastProcessedTimestamp?: Date }> = {};

  dailyTx = {
    createMany: async ({ data }: { data: DailyTxRecord[] }) => {
      this.dailyTxData = data;
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyTxData = this.dailyTxData.filter((tx) => tx.date.getTime() !== where.date.getTime());
    },
  };

  dailyTransfer = {
    createMany: async ({ data }: { data: DailyTransferRecord[] }) => {
      this.dailyTransferData = data;
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyTransferData = this.dailyTransferData.filter(
        (transfer) => transfer.date.getTime() !== where.date.getTime(),
      );
    },
  };

  dailyAssetStat = {
    createMany: async ({ data }: { data: DailyAssetStatRecord[] }) => {
      this.dailyAssetStatData = data;
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyAssetStatData = this.dailyAssetStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
    },
  };

  dailyMethodStat = {
    createMany: async ({ data }: { data: DailyMethodStatRecord[] }) => {
      this.dailyMethodStatData = data;
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyMethodStatData = this.dailyMethodStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
    },
  };

  dailyContractStat = {
    createMany: async ({ data }: { data: DailyContractStatRecord[] }) => {
      this.dailyContractStatData = data;
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      this.dailyContractStatData = this.dailyContractStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
    },
  };

  dailyStat = {
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { date: Date };
      update: DailyStatRecord;
      create: DailyStatRecord;
    }) => {
      const key = where.date.toISOString();
      this.dailyStatData[key] = { ...create, ...update };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      delete this.dailyStatData[where.date.toISOString()];
    },
  };

  ingestionCursor = {
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { network: string };
      update: { lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
      create: { network: string; lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
    }) => {
      const key = where.network;
      this.ingestionCursorData[key] = { ...create, ...update };
    },
  };

  $transaction = async <T>(callback: (tx: IngestionPrismaClient) => Promise<T>): Promise<T> =>
    callback(this);
}

describe('IngestionService', () => {
  it('ingests transactions and aggregates stats', async () => {
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({
        blockStart: 1,
        blockEnd: 2,
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

    const service = new IngestionService(neoClient, prisma, configService);
    await service.ingestDay('2024-05-01');

    expect(prisma.dailyTxData).toHaveLength(2);
    expect(prisma.dailyTransferData).toHaveLength(3);

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 1)).toISOString()];
    expect(stat.totalTxCount).toBe(2);
    expect(stat.swapsCount).toBe(1);
    expect(stat.transfersCount).toBe(1);
    expect(stat.gasClaimsCount).toBe(0);
    expect(stat.ignoredCount).toBe(0);
    expect(stat.realUsageTotal).toBe(2);
    expect(stat.totalTransfers).toBe(3);
    expect(stat.uniqueSenders).toBe(2);
    expect(stat.uniqueReceivers).toBe(2);
    expect(stat.uniqueAddresses).toBe(2);
    expect(stat.neoVolumeRaw).toBe(1n);
    expect(stat.gasVolumeRaw).toBe(12n);
    expect(stat.blockCount).toBe(2);

    const neoAsset = prisma.dailyAssetStatData.find((asset) => asset.asset === 'NEO');
    const gasAsset = prisma.dailyAssetStatData.find((asset) => asset.asset === 'GAS');
    expect(neoAsset?.transferCount).toBe(1);
    expect(neoAsset?.txCount).toBe(1);
    expect(neoAsset?.volumeRaw).toBe(1n);
    expect(gasAsset?.transferCount).toBe(2);
    expect(gasAsset?.txCount).toBe(2);
    expect(gasAsset?.volumeRaw).toBe(12n);

    expect(prisma.dailyMethodStatData).toHaveLength(1);
    expect(prisma.dailyMethodStatData[0].method).toBe('swap');
    expect(prisma.dailyMethodStatData[0].txCount).toBe(1);

    expect(prisma.dailyContractStatData).toHaveLength(1);
    expect(prisma.dailyContractStatData[0].contract).toBe('0xanycontract');
    expect(prisma.dailyContractStatData[0].txCount).toBe(1);
  });
});
