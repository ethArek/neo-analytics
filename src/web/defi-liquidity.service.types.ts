export type TrackedLiquidityAsset = {
  asset: string;
  symbol: string;
  balance: number;
  usdValue: number;
  stablecoin: boolean;
};

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type TrackedLiquiditySnapshot = {
  trackedTvlUsd: number;
  stablecoinLiquidityUsd: number;
  poolCount: number;
  pricedAssets: number;
  topAssets: TrackedLiquidityAsset[];
};
