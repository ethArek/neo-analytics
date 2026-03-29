export type ChangeTone = 'positive' | 'negative' | 'neutral';

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type DashboardTokenPerformanceEntry = {
  symbol: string;
  detail: string;
  changeLabel: string;
  tone: ChangeTone;
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

export type DashboardTokenPerformanceFilters = Partial<
  Record<DashboardTokenPerformancePeriod, ReadonlySet<string>>
>;

export type MarketPrices = {
  neo: MarketPriceEntry;
  gas: MarketPriceEntry;
};

export type MarketPriceEntry = {
  price: string | null;
  change24h: string | null;
  tone: ChangeTone;
};

export type FlamingoPriceRow = {
  symbol: string;
  unwrappedSymbol: string;
  hash: string;
  usdPrice: number;
};

export type FlamingoDexVolumeRow = {
  date: string;
  swapVolume: number;
  totalOrderVolume: number;
};

export type CoinPaprikaTicker = {
  quotes?: {
    USD?: {
      price?: unknown;
      percent_change_24h?: unknown;
    };
  };
};
