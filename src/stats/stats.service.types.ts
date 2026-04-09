import type { TxType } from '@prisma/client';
import type { PrismaService } from '../common/prisma.service';

export type DateRange = {
  from: Date;
  to: Date;
};

export type AggregatedAssetStat = {
  asset: string;
  transferCount: number;
  txCount: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  volumeRaw: bigint;
};

export type AggregatedCount = {
  key: string;
  count: number;
};

export type TopAddress = {
  address: string;
  transferCount: number;
  volumeRaw: bigint;
};

export type UniqueAddressStats = {
  uniqueSenders: number;
  uniqueReceivers: number;
  uniqueAddresses: number;
};

export type SwapUsdCoverage = {
  swapCount: number;
  pricedSwapCount: number;
  missingSwapCount: number;
};

export type SwapAssetStat = {
  asset: string;
  swapCount: number;
  totalUsdValue: string;
  averageUsdValue: string;
};

export type SwapAssetActivity = {
  date: Date;
  asset: string;
};

export type AssetTransactionTypeCount = {
  type: TxType;
  txCount: number;
};

export type AssetRecentTransaction = {
  date: Date;
  txid: string;
  type: TxType;
  timestamp: Date;
  amountRaw: bigint;
  transferCount: number;
  method: string | null;
};

export type DailyStatRow = Awaited<ReturnType<PrismaService['dailyStat']['findMany']>>[number];

export type DailyStatWithBigInt = Omit<
  DailyStatRow,
  'neoVolumeRaw' | 'gasVolumeRaw' | 'swapsUsdValue'
> & {
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  swapsUsdValue: string;
};

export type DailyTxRow = Awaited<ReturnType<PrismaService['dailyTx']['findMany']>>[number];

export type DailyTxWithBigInt = Omit<DailyTxRow, 'amountRaw' | 'swapUsdValue'> & {
  amountRaw: bigint | null;
  swapUsdValue: string | null;
};

export type DailyAssetStatRow = Awaited<
  ReturnType<PrismaService['dailyAssetStat']['findMany']>
>[number];

export type DailyAssetStatWithBigInt = Omit<DailyAssetStatRow, 'volumeRaw'> & {
  volumeRaw: bigint;
};

export type StatsRange = {
  stats: DailyStatWithBigInt[];
  range?: DateRange;
};

export type DayDetailsOptions = {
  page: number;
  pageSize: number;
};

export type DayDetailsPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
