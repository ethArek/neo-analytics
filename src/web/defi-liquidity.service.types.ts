export type TrackedLiquidityAsset = {
  asset: string;
  symbol: string;
  balance: number;
  usdValue: number;
  stablecoin: boolean;
};

export type TrackedLiquiditySnapshot = {
  trackedTvlUsd: number;
  stablecoinLiquidityUsd: number;
  trackedContracts: number;
  pricedAssets: number;
  topAssets: TrackedLiquidityAsset[];
};
