import type { ResolvedDefiWindow } from './defi-metrics.types';

export type StatTotals = {
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

export type DefiBanner = {
  tone: 'neutral' | 'warning' | 'danger';
  statusLabel: string;
  title: string;
  body: string;
};

export type DefiCoverageWindow = Pick<ResolvedDefiWindow, 'availableFrom' | 'effectiveFrom'>;

export type DefiBannerWindow = Pick<
  ResolvedDefiWindow,
  'availableFrom' | 'effectiveFrom' | 'effectiveTo'
>;
