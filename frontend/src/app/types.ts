export type ChangeTone = 'positive' | 'negative' | 'neutral';

export type NavState = {
  dashboard?: boolean;
  neoX?: boolean;
  defi?: boolean;
  faq?: boolean;
  specialThanks?: boolean;
};

export type MarketPriceEntry = {
  price: string | null;
  change24h: string | null;
  tone: ChangeTone;
};

export type MarketPrices = {
  neo: MarketPriceEntry;
  gas: MarketPriceEntry;
};

type SharedPageData = {
  marketPrices?: MarketPrices;
};

export type DashboardTotals = {
  totalTxs: string;
  transactionsExcludingGasClaims: string;
  oracle: string;
  others: string;
  activeAddresses: string;
  neoVolume: string;
  gasVolume: string;
  blocks: string;
};

export type DashboardTokenPerformanceEntry = {
  symbol: string;
  detail: string;
  changeLabel: string;
  tone: 'positive' | 'negative' | 'neutral';
};

export type DashboardTokenPerformancePeriod = 'last24h' | 'last7d' | 'last30d';

export type DashboardTokenPerformanceWindow = {
  label: string;
  gainers: DashboardTokenPerformanceEntry[];
  losers: DashboardTokenPerformanceEntry[];
};

export type DashboardTokenPerformance = Record<
  DashboardTokenPerformancePeriod,
  DashboardTokenPerformanceWindow
>;

export type DashboardAddress = {
  address: string;
  shortAddress: string;
  addressLabel?: string;
  transferCount: string;
};

export type DashboardAssetBreakdown = {
  assetLabel: string;
  assetHref?: string;
  transferCount: string;
  volumeLabel: string;
};

export type DashboardChartData = {
  labels: string[];
  series: {
    swaps: number[];
    oracle: number[];
    transfers: number[];
    gasClaims: number[];
    others: number[];
    transactionsExcludingGasClaims: number[];
    totalTxs: number[];
    activeAddresses: number[];
    neoVolume: number[];
    gasVolume: number[];
  };
  assets: {
    labels: string[];
    values: number[];
  };
};

export type DashboardData = SharedPageData & {
  nav?: NavState;
  totals?: DashboardTotals;
  chartData?: DashboardChartData;
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
  topSenders?: DashboardAddress[];
  topReceivers?: DashboardAddress[];
  assetBreakdown?: DashboardAssetBreakdown[];
};

export type DefiTotals = {
  estimatedSwapUsdValue: string;
  swaps: string;
  averageSwapUsdValue: string;
  coveredDays: string;
  requestedDays: string;
  activityShare: string;
  activeSwapWallets: string;
};

export type DefiChartData = {
  labels: string[];
  series: {
    swapUsdValue: number[];
    swaps: number[];
  };
};

export type DefiLiquidityAsset = {
  symbol: string;
  balanceLabel: string;
  usdValueLabel: string;
  stablecoin: boolean;
};

export type DefiOnChainOverview = {
  latestDayDexVolume: string;
  latestDayLabel: string;
  last7dDexVolume: string;
  last7dLabel: string;
  recentVolumeNotice?: string | null;
  trackedTvl: string | null;
  stablecoinLiquidity: string | null;
  stablecoinShare: string | null;
  poolCount: string | null;
  pricedAssets: string | null;
  topLiquidityAssets?: DefiLiquidityAsset[];
};

export type DefiSwapAsset = {
  assetLabel: string;
  swaps: string;
  usdVolume: string;
  averageSwapUsdValue: string;
};

export type DefiSwapTransaction = {
  txid: string;
  shortTxid: string;
  timestampLabel: string;
  dayLabel: string;
  dayHref: string;
  assetLabel: string;
  amountLabel: string;
  usdValueLabel: string;
  method: string | null;
};

export type DefiData = SharedPageData & {
  nav?: NavState;
  tokenPerformance?: DashboardTokenPerformance;
  totals?: DefiTotals | null;
  chartData?: DefiChartData | null;
  onChainOverview?: DefiOnChainOverview | null;
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
  topSwapAssets?: DefiSwapAsset[];
  largestSwaps?: DefiSwapTransaction[];
  recentSwaps?: DefiSwapTransaction[];
};

export type MetricCard = {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
};

export type NeoXChartData = {
  labels: string[];
  series: {
    transactions: number[];
    rollingAverage: number[];
    cumulativeTransactions: number[];
  };
};

export type NeoXRecentTransaction = {
  hash: string;
  shortHash: string;
  timestampLabel: string;
  methodLabel: string;
  statusLabel: string;
  fromLabel: string;
  fromMeta: string;
  fromHref?: string | null;
  toLabel: string;
  toMeta: string;
  toHref?: string | null;
  feeLabel: string;
  typeLabel: string;
};

export type NeoXToken = {
  address: string;
  shortAddress: string;
  symbol: string;
  name: string;
  holdersLabel: string;
  totalSupplyLabel: string;
  typeLabel: string;
};

export type NeoXData = SharedPageData & {
  nav?: NavState;
  status?: 'ready' | 'empty' | 'error';
  message?: string | null;
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
  availableRangeLabel?: string | null;
  summaryCards?: MetricCard[];
  chartData?: NeoXChartData | null;
  recentTransactions?: NeoXRecentTransaction[];
  topTokens?: NeoXToken[];
};

export type DaysStat = {
  dateLabel: string;
  totalTxCountLabel: string;
  swapsCountLabel: string;
  oracleCountLabel: string;
  transfersCountLabel: string;
  gasClaimsCountLabel: string;
  othersCountLabel: string;
  transactionsExcludingGasClaimsLabel: string;
};

export type DaysData = SharedPageData & {
  nav?: NavState;
  stats?: DaysStat[];
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
};

export type DayStat = {
  totalTxCount: number;
  transactionsExcludingGasClaims: number;
  oracleCount: number;
  uniqueAddresses: number;
  neoVolume: string;
  gasVolume: string;
  othersCount: number;
  blockCount: number;
};

export type DayTransaction = {
  txid?: string;
  timestampLabel: string;
  shortTxid: string;
  type: string;
  assetLabel: string;
  amountLabel: string;
  from: string | null;
  to: string | null;
  method: string | null;
};

export type DayAssetStat = {
  assetLabel: string;
  assetHref?: string;
  transferCount: number;
  volumeLabel: string;
};

export type DayPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  pageSizeOptions?: number[];
};

export type DayData = SharedPageData & {
  nav?: NavState;
  date?: string;
  stat?: DayStat | null;
  transactions?: DayTransaction[];
  pagination?: DayPagination;
  assetStats?: DayAssetStat[];
};

export type AssetSummary = {
  volumeLabel: string;
  transferCount: string;
  txCount: string;
  activeAddresses: string;
  uniqueSenders: string;
  uniqueReceivers: string;
  swapsCount: string;
  transfersCount: string;
  otherCount: string;
  swapShare: string;
  transferShare: string;
  oracleCount: string;
  gasClaimsCount: string;
  ignoredCount: string;
};

export type AssetDefiRelation = {
  marketSymbol: string;
  currentPrice: string | null;
  change24h: string | null;
  change7d: string | null;
  change30d: string | null;
  trackedLiquidityUsd: string | null;
  trackedLiquidityBalance: string | null;
  stablecoin: boolean;
  hasMarketPrice: boolean;
  hasTrackedLiquidity: boolean;
};

export type AssetTypeBreakdown = {
  key: string;
  label: string;
  count: string;
  share: string;
};

export type AssetDailyActivity = {
  dateLabel: string;
  dayHref: string;
  transferCount: string;
  txCount: string;
  uniqueSenders: string;
  uniqueReceivers: string;
  volumeLabel: string;
};

export type AssetAddress = {
  address: string;
  shortAddress: string;
  addressLabel?: string;
  transferCount: string;
  volumeLabel: string;
};

export type AssetRecentTransaction = {
  txid: string;
  shortTxid: string;
  timestampLabel: string;
  dayLabel: string;
  dayHref: string;
  type: string;
  amountLabel: string;
  transferCount: string;
  method: string | null;
};

export type AssetData = SharedPageData & {
  nav?: NavState;
  assetLabel?: string;
  assetId?: string;
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
  summary?: AssetSummary | null;
  defiRelation?: AssetDefiRelation | null;
  typeBreakdown?: AssetTypeBreakdown[];
  dailyActivity?: AssetDailyActivity[];
  topSenders?: AssetAddress[];
  topReceivers?: AssetAddress[];
  recentTransactions?: AssetRecentTransaction[];
};

export type AdminData = SharedPageData & {
  email?: string;
  defaultDate?: string;
  message?: string;
  error?: string;
};

export type AdminLoginData = SharedPageData & {
  email?: string;
  error?: string;
};

export type PageData =
  | DashboardData
  | DefiData
  | NeoXData
  | DaysData
  | DayData
  | AssetData
  | AdminData
  | AdminLoginData;
