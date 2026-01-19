import { ConfigService } from '@nestjs/config';
import { DailyStat, IngestionCursor, Prisma } from '@prisma/client';
import { IngestionService } from '../src/ingestion/ingestion.service';
import {
  DailyAssetStatCreateRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatUpsertRecord,
  DailyTransferCreateRecord,
  DailyTxCreateRecord,
  IngestionPrismaClient,
} from '../src/ingestion/ingestion.types';
import { NeoClient } from '../src/neo-client/neo-client.interface';

class FakePrismaService implements IngestionPrismaClient {
  dailyTxData: DailyTxCreateRecord[] = [];
  dailyTransferData: DailyTransferCreateRecord[] = [];
  dailyAssetStatData: DailyAssetStatCreateRecord[] = [];
  dailyMethodStatData: DailyMethodStatRecord[] = [];
  dailyContractStatData: DailyContractStatRecord[] = [];
  dailyStatData: Record<string, DailyStatUpsertRecord> = {};
  ingestionCursorData: Record<string, { lastProcessedBlock?: number; lastProcessedTimestamp?: Date }> = {};

  dailyTx = {
    createMany: async ({ data }: { data: DailyTxCreateRecord[]; skipDuplicates?: boolean }) => {
      this.dailyTxData.push(...data);

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyTxData.length;
      this.dailyTxData = this.dailyTxData.filter((tx) => tx.date.getTime() !== where.date.getTime());
      const after = this.dailyTxData.length;

      return { count: before - after };
    },
  };

  dailyTransfer = {
    createMany: async ({ data }: { data: DailyTransferCreateRecord[]; skipDuplicates?: boolean }) => {
      this.dailyTransferData.push(...data);

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyTransferData.length;
      this.dailyTransferData = this.dailyTransferData.filter(
        (transfer) => transfer.date.getTime() !== where.date.getTime(),
      );
      const after = this.dailyTransferData.length;

      return { count: before - after };
    },
  };

  dailyAssetStat = {
    createMany: async ({ data }: { data: DailyAssetStatCreateRecord[] }) => {
      this.dailyAssetStatData = data;

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyAssetStatData.length;
      this.dailyAssetStatData = this.dailyAssetStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
      const after = this.dailyAssetStatData.length;

      return { count: before - after };
    },
  };

  dailyMethodStat = {
    createMany: async ({ data }: { data: DailyMethodStatRecord[] }) => {
      this.dailyMethodStatData = data;

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyMethodStatData.length;
      this.dailyMethodStatData = this.dailyMethodStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
      const after = this.dailyMethodStatData.length;

      return { count: before - after };
    },
  };

  dailyContractStat = {
    createMany: async ({ data }: { data: DailyContractStatRecord[] }) => {
      this.dailyContractStatData = data;

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyContractStatData.length;
      this.dailyContractStatData = this.dailyContractStatData.filter(
        (stat) => stat.date.getTime() !== where.date.getTime(),
      );
      const after = this.dailyContractStatData.length;

      return { count: before - after };
    },
  };

  dailyStat = {
    findUnique: async ({ where }: { where: { date: Date } }) => {
      const key = where.date.toISOString();
      const record = this.dailyStatData[key];
      if (!record) {
        return null;
      }

      return this.buildDailyStat(where.date, record);
    },
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { date: Date };
      update: DailyStatUpsertRecord;
      create: DailyStatUpsertRecord;
    }) => {
      const key = where.date.toISOString();
      const record = { ...create, ...update };
      this.dailyStatData[key] = record;

      return this.buildDailyStat(where.date, record);
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const key = where.date.toISOString();
      const existed = this.dailyStatData[key] ? 1 : 0;
      delete this.dailyStatData[key];

      return { count: existed };
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
      const record = { ...create, ...update };
      this.ingestionCursorData[key] = record;

      return this.buildIngestionCursor(key, record);
    },
  };

  $transaction = async <T>(callback: (tx: IngestionPrismaClient) => Promise<T>): Promise<T> =>
    callback(this);

  private buildDailyStat(date: Date, record: DailyStatUpsertRecord): DailyStat {
    const now = new Date();

    return {
      id: 1,
      date,
      totalTxCount: record.totalTxCount,
      swapsCount: record.swapsCount,
      transfersCount: record.transfersCount,
      gasClaimsCount: record.gasClaimsCount,
      ignoredCount: record.ignoredCount,
      realUsageTotal: record.realUsageTotal,
      totalTransfers: record.totalTransfers,
      uniqueSenders: record.uniqueSenders,
      uniqueReceivers: record.uniqueReceivers,
      uniqueAddresses: record.uniqueAddresses,
      neoVolumeRaw: new Prisma.Decimal(record.neoVolumeRaw),
      gasVolumeRaw: new Prisma.Decimal(record.gasVolumeRaw),
      blockCount: record.blockCount,
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildIngestionCursor(
    network: string,
    record: { lastProcessedBlock?: number; lastProcessedTimestamp?: Date }
  ): IngestionCursor {
    const now = new Date();

    return {
      id: 1,
      network,
      lastProcessedBlock: record.lastProcessedBlock ?? null,
      lastProcessedTimestamp: record.lastProcessedTimestamp ?? null,
      updatedAt: now,
    };
  }
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
    expect(BigInt(stat.neoVolumeRaw)).toBe(1n);
    expect(BigInt(stat.gasVolumeRaw)).toBe(12n);
    expect(stat.blockCount).toBe(2);

    const neoAsset = prisma.dailyAssetStatData.find((asset) => asset.asset === 'NEO');
    const gasAsset = prisma.dailyAssetStatData.find((asset) => asset.asset === 'GAS');
    expect(neoAsset?.transferCount).toBe(1);
    expect(neoAsset?.txCount).toBe(1);
    expect(neoAsset ? BigInt(neoAsset.volumeRaw) : null).toBe(1n);
    expect(gasAsset?.transferCount).toBe(2);
    expect(gasAsset?.txCount).toBe(2);
    expect(gasAsset ? BigInt(gasAsset.volumeRaw) : null).toBe(12n);

    expect(prisma.dailyMethodStatData).toHaveLength(1);
    expect(prisma.dailyMethodStatData[0].method).toBe('swap');
    expect(prisma.dailyMethodStatData[0].txCount).toBe(1);

    expect(prisma.dailyContractStatData).toHaveLength(1);
    expect(prisma.dailyContractStatData[0].contract).toBe('0xanycontract');
    expect(prisma.dailyContractStatData[0].txCount).toBe(1);
  });

  it('persists values exceeding int64 safely', async () => {
    const hugeAmount = '1008014113209251463173';
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({
        transactions: [
          {
            txid: 'huge-neo-transfer',
            timestamp: new Date().toISOString(),
            blockIndex: 42,
            transfers: [{ from: 'a', to: 'b', asset: 'NEO', amount: hugeAmount }],
            raw: { amountRaw: BigInt(hugeAmount) },
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
    await service.ingestDay('2024-05-02');

    expect(prisma.dailyTxData).toHaveLength(1);
    expect(prisma.dailyTxData[0].amountRaw).toBe(hugeAmount);
    expect(prisma.dailyTxData[0].rawJson).toEqual({ amountRaw: hugeAmount });
    expect(prisma.dailyTransferData).toHaveLength(1);
    expect(prisma.dailyTransferData[0].amountRaw).toBe(hugeAmount);

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 2)).toISOString()];
    expect(stat.neoVolumeRaw).toBe(hugeAmount);
    expect(stat.gasVolumeRaw).toBe('0');
  });
});
