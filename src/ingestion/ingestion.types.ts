import type { ClassifiedType } from '../classifier/classifier';
import type { DailyStat, IngestionCursor, Prisma } from '@prisma/client';

export type DailyTxRecord = {
  date: Date;
  txid: string;
  type: ClassifiedType;
  from?: string;
  to?: string;
  asset?: string;
  amountRaw?: bigint;
  swapUsdValue?: string;
  transferCount: number;
  method?: string;
  contract?: string;
  timestamp: Date;
  blockIndex?: number;
  rawJson: Record<string, unknown>;
};

export type DailyTxCreateRecord = Omit<DailyTxRecord, 'amountRaw' | 'rawJson'> & {
  amountRaw?: string;
  rawJson: Prisma.InputJsonValue;
};

export type DailyTransferRecord = {
  date: Date;
  txid: string;
  transferIndex: number;
  asset: string;
  amountRaw: bigint;
  from?: string;
  to?: string;
};

export type DailyTransferCreateRecord = Omit<DailyTransferRecord, 'amountRaw'> & {
  amountRaw: string;
};

export type DailyAssetStatRecord = {
  date: Date;
  asset: string;
  transferCount: number;
  txCount: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  volumeRaw: bigint;
};

export type DailyAssetStatCreateRecord = Omit<DailyAssetStatRecord, 'volumeRaw'> & {
  volumeRaw: string;
};

export type DailyMethodStatRecord = {
  date: Date;
  method: string;
  txCount: number;
};

export type DailyContractStatRecord = {
  date: Date;
  contract: string;
  txCount: number;
};

export type DailyStatRecord = {
  date: Date;
  totalTxCount: number;
  swapsCount: number;
  swapsUsdValue: string;
  transfersCount: number;
  gasClaimsCount: number;
  othersCount: number;
  realUsageTotal: number;
  totalTransfers: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  uniqueAddresses: number;
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  blockCount: number;
};

export type DailyStatUpsertRecord = Omit<DailyStatRecord, 'neoVolumeRaw' | 'gasVolumeRaw'> & {
  neoVolumeRaw: string;
  gasVolumeRaw: string;
};

export type IngestionPrismaClient = {
  dailyTx: {
    createMany: (args: {
      data: DailyTxCreateRecord[];
      skipDuplicates?: boolean;
    }) => Promise<Prisma.BatchPayload>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  dailyTransfer: {
    createMany: (args: {
      data: DailyTransferCreateRecord[];
      skipDuplicates?: boolean;
    }) => Promise<Prisma.BatchPayload>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  dailyAssetStat: {
    createMany: (args: { data: DailyAssetStatCreateRecord[] }) => Promise<Prisma.BatchPayload>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  dailyMethodStat: {
    createMany: (args: { data: DailyMethodStatRecord[] }) => Promise<Prisma.BatchPayload>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  dailyContractStat: {
    createMany: (args: { data: DailyContractStatRecord[] }) => Promise<Prisma.BatchPayload>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  dailyStat: {
    findUnique: (args: { where: { date: Date } }) => Promise<DailyStat | null>;
    upsert: (args: {
      where: { date: Date };
      update: DailyStatUpsertRecord;
      create: DailyStatUpsertRecord;
    }) => Promise<DailyStat>;
    deleteMany: (args: { where: { date: Date } }) => Promise<Prisma.BatchPayload>;
  };
  ingestionCursor: {
    upsert: (args: {
      where: { network: string };
      update: { lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
      create: { network: string; lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
    }) => Promise<IngestionCursor>;
  };
  $transaction: <T>(callback: (tx: IngestionPrismaClient) => Promise<T>) => Promise<T>;
};
