export type NavState = {
  dashboard?: boolean;
  defi?: boolean;
  faq?: boolean;
  specialThanks?: boolean;
};

export type DashboardTotals = {
  totalTxs: string;
  realUsage: string;
  activeAddresses: string;
  neoVolume: string;
  gasVolume: string;
  blocks: string;
};

export type DashboardDefiCard = {
  href: string;
  headline: string;
  description: string;
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
  transferCount: string;
};

export type DashboardAssetBreakdown = {
  assetLabel: string;
  transferCount: string;
  volumeLabel: string;
};

export type DashboardChartData = {
  labels: string[];
  series: {
    swaps: number[];
    transfers: number[];
    gasClaims: number[];
    others: number[];
    realUsage: number[];
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

export type DashboardData = {
  nav?: NavState;
  totals?: DashboardTotals;
  defiCard?: DashboardDefiCard;
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
};

export type DefiChartData = {
  labels: string[];
  series: {
    swapUsdValue: number[];
    swaps: number[];
  };
};

export type DefiDailyStat = {
  dateLabel: string;
  swapsLabel: string;
  swapUsdValue: string;
};

export type DefiBanner = {
  tone: 'neutral' | 'warning' | 'danger';
  statusLabel: string;
  title: string;
  body: string;
};

export type DefiData = {
  nav?: NavState;
  status?: 'ready' | 'partial' | 'unavailable' | 'not-configured' | 'invalid';
  tokenPerformance?: DashboardTokenPerformance;
  availabilityFrom?: string;
  requestedFrom?: string;
  requestedTo?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  requestedRangeLabel?: string;
  effectiveRangeLabel?: string;
  coverageNote?: string;
  banner?: DefiBanner;
  totals?: DefiTotals;
  chartData?: DefiChartData;
  dailyStats?: DefiDailyStat[];
  methodology?: string[];
};

export type DaysStat = {
  dateLabel: string;
  totalTxCountLabel: string;
  swapsCountLabel: string;
  transfersCountLabel: string;
  gasClaimsCountLabel: string;
  othersCountLabel: string;
  realUsageTotalLabel: string;
};

export type DaysData = {
  nav?: NavState;
  stats?: DaysStat[];
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
};

export type DayStat = {
  totalTxCount: number;
  realUsageTotal: number;
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
  transferCount: number;
  volumeLabel: string;
};

export type DayMethodStat = {
  method: string;
  txCount: number;
};

export type DayContractStat = {
  contract: string;
  txCount: number;
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

export type DayData = {
  nav?: NavState;
  date?: string;
  stat?: DayStat | null;
  transactions?: DayTransaction[];
  pagination?: DayPagination;
  assetStats?: DayAssetStat[];
  methodStats?: DayMethodStat[];
  contractStats?: DayContractStat[];
};

export type AdminData = {
  email?: string;
  defaultDate?: string;
  message?: string;
  error?: string;
};

export type AdminLoginData = {
  email?: string;
  error?: string;
};

export type PageData = DashboardData | DefiData | DaysData | DayData | AdminData | AdminLoginData;
