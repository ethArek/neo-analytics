import { ClassifiedType } from '../classifier/classifier';

export type DailyTxRecord = {
  date: Date;
  txid: string;
  type: ClassifiedType;
  from?: string;
  to?: string;
  asset?: string;
  amountRaw?: string;
  transferCount: number;
  method?: string;
  contract?: string;
  timestamp: Date;
  blockIndex?: number;
  rawJson: Record<string, unknown>;
};

export type DailyTransferRecord = {
  date: Date;
  txid: string;
  transferIndex: number;
  asset: string;
  amountRaw: string;
  from?: string;
  to?: string;
};

export type DailyAssetStatRecord = {
  date: Date;
  asset: string;
  transferCount: number;
  txCount: number;
  uniqueSenders: number;
  uniqueReceivers: number;
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
  transfersCount: number;
  gasClaimsCount: number;
  ignoredCount: number;
  realUsageTotal: number;
  totalTransfers: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  uniqueAddresses: number;
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  blockCount: number;
};

export type IngestionPrismaClient = {
  dailyTx: {
    createMany: (args: { data: DailyTxRecord[]; skipDuplicates?: boolean }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  dailyTransfer: {
    createMany: (args: { data: DailyTransferRecord[]; skipDuplicates?: boolean }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  dailyAssetStat: {
    createMany: (args: { data: DailyAssetStatRecord[] }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  dailyMethodStat: {
    createMany: (args: { data: DailyMethodStatRecord[] }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  dailyContractStat: {
    createMany: (args: { data: DailyContractStatRecord[] }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  dailyStat: {
    upsert: (args: {
      where: { date: Date };
      update: DailyStatRecord;
      create: DailyStatRecord;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { date: Date } }) => Promise<unknown>;
  };
  ingestionCursor: {
    upsert: (args: {
      where: { network: string };
      update: { lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
      create: { network: string; lastProcessedBlock?: number; lastProcessedTimestamp?: Date };
    }) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: IngestionPrismaClient) => Promise<T>) => Promise<T>;
};
