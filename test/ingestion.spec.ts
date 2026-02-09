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
  ingestionCursorData: Record<
    string,
    { lastProcessedBlock?: number; lastProcessedTimestamp?: Date }
  > = {};

  dailyTx = {
    createMany: async ({ data }: { data: DailyTxCreateRecord[]; skipDuplicates?: boolean }) => {
      this.dailyTxData.push(...data);

      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { date: Date } }) => {
      const before = this.dailyTxData.length;
      this.dailyTxData = this.dailyTxData.filter(
        (tx) => tx.date.getTime() !== where.date.getTime(),
      );
      const after = this.dailyTxData.length;

      return { count: before - after };
    },
  };

  dailyTransfer = {
    createMany: async ({
      data,
    }: {
      data: DailyTransferCreateRecord[];
      skipDuplicates?: boolean;
    }) => {
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
      othersCount: record.othersCount,
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
    record: { lastProcessedBlock?: number; lastProcessedTimestamp?: Date },
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
    expect(stat.othersCount).toBe(0);
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

  it('handles pagination, mixed classes, normalization, and JSON serialization during day ingestion', async () => {
    const circular: Record<string, unknown> = {
      label: 'root',
    };
    circular.self = circular;

    const timestamp = new Date('2024-05-03T12:00:00.000Z').toISOString();
    const neoClient: NeoClient = {
      fetchTransactionsForDay: jest.fn().mockImplementation((_date: string, cursor?: string) => {
        if (!cursor) {
          return Promise.resolve({
            nextCursor: 'page-2',
            blockStart: 10,
            blockEnd: 20,
            transactions: [
              {
                txid: 'swap-serialized',
                timestamp,
                blockIndex: 10,
                invocation: {
                  contract: 'ABCD',
                  method: ' Swap ',
                },
                transfers: [
                  { from: 'SenderA', to: 'ReceiverA', asset: ' tokenhash ', amount: '5' },
                  { from: 'SenderA', to: 'ReceiverA', asset: 'NEO', amount: '2' },
                ],
                raw: {
                  text: 'hello',
                  enabled: true,
                  finite: 1,
                  infinite: Number.POSITIVE_INFINITY,
                  bigint: 12n,
                  date: new Date('2024-05-03T00:00:00.000Z'),
                  buffer: Buffer.from('ab', 'hex'),
                  bytes: new Uint8Array([1, 2]),
                  list: [1, undefined, 'x'],
                  map: new Map([
                    ['a', 1],
                    ['b', undefined],
                  ]),
                  set: new Set(['alpha', 2]),
                  symbolValue: Symbol('demo'),
                  circular,
                },
              },
              {
                txid: 'gas-claim',
                timestamp,
                blockIndex: 11,
                transfers: [{ from: ' ', to: 'ReceiverGas', asset: 'GAS', amount: '10' }],
                raw: {},
              },
            ],
          });
        }

        return Promise.resolve({
          blockStart: 10,
          blockEnd: 20,
          transactions: [
            {
              txid: 'normal-transfer',
              timestamp,
              blockIndex: 12,
              invocation: {
                method: '   ',
                contract: '   ',
              },
              transfers: [
                { from: 'Alice', to: 'Bob', asset: 'customasset', amount: '9' },
                { from: 'Alice', to: 'Bob', asset: 'badasset', amount: 'not-a-number' },
              ],
              raw: {},
            },
            {
              txid: 'ignored-empty',
              timestamp,
              raw: {},
            },
            {
              txid: 'swap-second',
              timestamp,
              blockIndex: 14,
              invocation: {
                contract: '0xABCD',
                method: 'SWAP',
              },
              transfers: [
                { from: 'senderB', to: 'receiverB', asset: 'gas', amount: '3' },
                { from: 'senderB', to: 'receiverC', asset: 'neo', amount: '4' },
              ],
              raw: {},
            },
          ],
        });
      }),
    };
    const prisma = new FakePrismaService();
    const configService = new ConfigService({
      app: {
        neoNetwork: 'MainNet',
      },
    });
    const service = new IngestionService(neoClient, prisma, configService);

    Object.defineProperty(service, 'txBatchSize', { value: 1 });
    Object.defineProperty(service, 'transferBatchSize', { value: 1 });

    await service.ingestDay('2024-05-03');

    expect(neoClient.fetchTransactionsForDay).toHaveBeenCalledTimes(2);
    expect(prisma.dailyTxData).toHaveLength(5);
    expect(prisma.dailyTransferData).toHaveLength(6);

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 3)).toISOString()];
    expect(stat.totalTxCount).toBe(5);
    expect(stat.swapsCount).toBe(2);
    expect(stat.transfersCount).toBe(1);
    expect(stat.gasClaimsCount).toBe(1);
    expect(stat.othersCount).toBe(1);
    expect(stat.realUsageTotal).toBe(3);
    expect(stat.totalTransfers).toBe(6);
    expect(stat.uniqueSenders).toBe(3);
    expect(stat.uniqueReceivers).toBe(5);
    expect(stat.uniqueAddresses).toBe(8);
    expect(stat.neoVolumeRaw).toBe('6');
    expect(stat.gasVolumeRaw).toBe('13');
    expect(stat.blockCount).toBe(11);

    expect(prisma.ingestionCursorData.MainNet?.lastProcessedBlock).toBe(14);
    expect(prisma.dailyMethodStatData).toHaveLength(1);
    expect(prisma.dailyMethodStatData[0].method).toBe('swap');
    expect(prisma.dailyMethodStatData[0].txCount).toBe(2);
    expect(prisma.dailyContractStatData).toHaveLength(1);
    expect(prisma.dailyContractStatData[0].contract).toBe('0xabcd');
    expect(prisma.dailyContractStatData[0].txCount).toBe(2);

    const serialized = prisma.dailyTxData.find((tx) => tx.txid === 'swap-serialized');
    expect(serialized?.asset).toBe('NEO');
    expect(serialized?.amountRaw).toBe('2');
    expect(serialized?.from).toBe('0xsendera');
    expect(serialized?.to).toBe('0xreceivera');
    expect(serialized?.method).toBe('swap');
    expect(serialized?.contract).toBe('0xabcd');
    expect(serialized?.rawJson).toEqual(
      expect.objectContaining({
        text: 'hello',
        enabled: true,
        finite: 1,
        infinite: null,
        bigint: '12',
        date: '2024-05-03T00:00:00.000Z',
        buffer: '0xab',
        bytes: '0x0102',
        list: [1, null, 'x'],
        map: [
          ['a', 1],
          ['b', null],
        ],
        set: ['alpha', 2],
        symbolValue: 'Symbol(demo)',
      }),
    );
    expect(serialized?.rawJson).toMatchObject({
      circular: {
        label: 'root',
        self: '[Circular]',
      },
    });
  });

  it('keeps block count at zero and does not update cursor when block index is missing', async () => {
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({
        transactions: [
          {
            txid: 'no-block',
            timestamp: new Date('2024-05-04T12:00:00.000Z').toISOString(),
            transfers: [{ from: 'a', to: 'b', asset: 'NEO', amount: '1' }],
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

    await service.ingestDay('2024-05-04');

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 4)).toISOString()];
    expect(stat.blockCount).toBe(0);
    expect(prisma.ingestionCursorData).toEqual({});
  });

  it('supports range ingestion fallback and paginated day loading', async () => {
    const fallbackDate = '2024-05-05';
    const start = new Date('2024-05-05T10:00:00.000Z');
    const end = new Date('2024-05-05T10:10:00.000Z');
    const neoClient: NeoClient = {
      fetchTransactionsForDay: jest.fn().mockImplementation((date: string, cursor?: string) => {
        expect(date).toBe(fallbackDate);
        if (!cursor) {
          return Promise.resolve({
            nextCursor: 'p2',
            transactions: [
              {
                txid: 'w1',
                timestamp: start.toISOString(),
                blockIndex: 21,
                invocation: {
                  method: 'swap',
                  contract: 'abcd',
                },
                transfers: [
                  { from: 'aa', to: 'bb', asset: 'NEO', amount: '2' },
                  { from: 'bb', to: 'aa', asset: 'GAS', amount: '5' },
                ],
                raw: {},
              },
            ],
          });
        }

        return Promise.resolve({
          blockStart: 21,
          blockEnd: 22,
          transactions: [
            {
              txid: 'w2',
              timestamp: end.toISOString(),
              blockIndex: 22,
              transfers: [{ from: 'cc', to: 'dd', asset: 'token', amount: '1' }],
              raw: {},
            },
          ],
        });
      }),
    };
    const prisma = new FakePrismaService();
    const configService = new ConfigService({
      app: {
        neoNetwork: 'MainNet',
      },
    });
    const service = new IngestionService(neoClient, prisma, configService);

    await service.ingestWindow(start, end);

    expect(neoClient.fetchTransactionsForDay).toHaveBeenCalledTimes(2);
    expect(prisma.dailyTxData).toHaveLength(2);
    expect(prisma.dailyTransferData).toHaveLength(3);

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 5)).toISOString()];
    expect(stat.totalTxCount).toBe(2);
    expect(stat.swapsCount).toBe(1);
    expect(stat.transfersCount).toBe(1);
    expect(stat.blockCount).toBe(2);
  });

  it('supports range ingestion with paginated range API', async () => {
    const start = new Date('2024-05-06T10:00:00.000Z');
    const end = new Date('2024-05-06T10:10:00.000Z');
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({ transactions: [] }),
      fetchTransactionsForRange: jest
        .fn()
        .mockImplementation((_start: Date, _end: Date, cursor?: string) => {
          if (!cursor) {
            return Promise.resolve({
              nextCursor: 'next',
              blockStart: 30,
              blockEnd: 31,
              transactions: [
                {
                  txid: 'range-1',
                  timestamp: start.toISOString(),
                  blockIndex: 30,
                  transfers: [{ from: 'x', to: 'y', asset: 'NEO', amount: '1' }],
                  raw: {},
                },
              ],
            });
          }

          return Promise.resolve({
            transactions: [
              {
                txid: 'range-2',
                timestamp: end.toISOString(),
                blockIndex: 31,
                transfers: [{ from: 'y', to: 'z', asset: 'GAS', amount: '2' }],
                raw: {},
              },
            ],
          });
        }),
    };
    const prisma = new FakePrismaService();
    const configService = new ConfigService({
      app: {
        neoNetwork: 'MainNet',
      },
    });
    const service = new IngestionService(neoClient, prisma, configService);

    await service.ingestWindow(start, end);

    expect(neoClient.fetchTransactionsForRange).toHaveBeenCalledTimes(2);
    expect(prisma.dailyTxData).toHaveLength(2);
    expect(prisma.dailyTransferData).toHaveLength(2);

    const stat = prisma.dailyStatData[new Date(Date.UTC(2024, 4, 6)).toISOString()];
    expect(stat.totalTxCount).toBe(2);
    expect(stat.blockCount).toBe(2);
  });

  it('checks existing day status and rebuilds by re-ingesting', async () => {
    let responseTxId = 'first-pass';
    const neoClient: NeoClient = {
      fetchTransactionsForDay: async () => ({
        transactions: [
          {
            txid: responseTxId,
            timestamp: new Date('2024-05-07T10:00:00.000Z').toISOString(),
            blockIndex: 100,
            transfers: [{ from: 'a', to: 'b', asset: 'NEO', amount: '1' }],
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

    expect(await service.isDayIngested('2024-05-07')).toBe(false);
    await service.ingestDay('2024-05-07');
    expect(await service.isDayIngested('2024-05-07')).toBe(true);

    responseTxId = 'second-pass';
    await service.rebuildDay('2024-05-07');

    expect(prisma.dailyTxData).toHaveLength(1);
    expect(prisma.dailyTxData[0].txid).toBe('second-pass');
  });
});
