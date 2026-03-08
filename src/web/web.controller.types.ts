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
