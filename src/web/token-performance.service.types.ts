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

export type FlamingoPriceRow = {
  symbol: string;
  unwrappedSymbol: string;
  hash: string;
  usdPrice: number;
};
