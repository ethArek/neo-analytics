export type NavState = {
  dashboard?: boolean;
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

export type DashboardAddress = {
  address: string;
  shortAddress: string;
  transferCount: string;
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
  chartData?: DashboardChartData;
  rangeLabel?: string;
  rangeFrom?: string;
  rangeTo?: string;
  topSenders?: DashboardAddress[];
  topReceivers?: DashboardAddress[];
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

export type DayData = {
  nav?: NavState;
  date?: string;
  stat?: DayStat | null;
  transactions?: DayTransaction[];
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

export type PageData = DashboardData &
  DaysData &
  DayData &
  AdminData &
  AdminLoginData & {
    nav?: NavState;
  };
