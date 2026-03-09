import { Prisma } from '@prisma/client';
import type { NeoTransaction } from '../neo-client/neo-client.interface';
import type {
  DailyAssetStatRecord,
  DailyContractStatRecord,
  DailyMethodStatRecord,
  DailyStatRecord,
  DailyTransferCreateRecord,
  DailyTransferRecord,
  DailyTxCreateRecord,
  DailyTxRecord,
} from './ingestion.types';

export type BlockRange = {
  start: number;
  end: number;
};

export type AssetAggregate = {
  transferCount: number;
  txCount: number;
  senders: Set<string>;
  receivers: Set<string>;
  volumeRaw: bigint;
};

export type MethodAggregate = {
  key: string;
  count: number;
};

export type ContractAggregate = {
  key: string;
  count: number;
};

export type TransactionBatch = {
  transactions: NeoTransaction[];
  blockRange?: BlockRange;
};

export type SwapPricingContext = {
  usdPricesByAsset: Map<string, Prisma.Decimal>;
  decimalsByAsset: Map<string, number | null>;
};

export type SwapPriceApiRow = {
  symbol?: unknown;
  unwrappedSymbol?: unknown;
  hash?: unknown;
  usd_price?: unknown;
};

export type DailySummary = {
  dailyTx: DailyTxRecord[];
  dailyTransfers: DailyTransferRecord[];
  dailyAssetStats: DailyAssetStatRecord[];
  dailyMethodStats: DailyMethodStatRecord[];
  dailyContractStats: DailyContractStatRecord[];
  dailyStat: DailyStatRecord;
};

export type BlockIndexState = {
  minBlockIndex?: number;
  maxBlockIndex?: number;
};

export type StreamState = BlockIndexState & {
  day: Date;
  txBuffer: DailyTxCreateRecord[];
  transferBuffer: DailyTransferCreateRecord[];
  assetMap: Map<string, AssetAggregate>;
  methodMap: Map<string, MethodAggregate>;
  contractMap: Map<string, ContractAggregate>;
  senders: Set<string>;
  receivers: Set<string>;
  addresses: Set<string>;
  swapsCount: number;
  swapsUsdValue: Prisma.Decimal;
  transfersCount: number;
  gasClaimsCount: number;
  othersCount: number;
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  totalTxCount: number;
  totalTransfers: number;
  lastProcessedBlock?: number;
  lastProcessedTimestamp?: Date;
};
