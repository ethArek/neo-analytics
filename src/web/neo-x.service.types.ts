export type NeoXAddressInfo = {
  hash: string;
  name: string | null;
  isContract: boolean;
  isVerified: boolean;
};

export type NeoXNetworkStats = {
  averageBlockTimeMs: number | null;
  averageGasPriceGwei: number | null;
  gasUsedToday: string | null;
  totalAddresses: number | null;
  totalBlocks: number | null;
  totalTransactions: number | null;
  transactionsToday: number | null;
};

export type NeoXTransactionChartPoint = {
  date: string;
  txCount: number;
};

export type NeoXDashboardHistory = {
  networkStats: NeoXNetworkStats | null;
  transactionChart: NeoXTransactionChartPoint[];
};

export type NeoXHistorySyncResult = {
  availableFrom: string | null;
  availableTo: string | null;
  persistedDays: number;
};

export type NeoXRecentTransaction = {
  hash: string;
  timestamp: string;
  status: string;
  method: string | null;
  from: NeoXAddressInfo | null;
  to: NeoXAddressInfo | null;
  feeWei: string | null;
  gasUsed: string | null;
  valueWei: string | null;
  txTypes: string[];
};

export type NeoXToken = {
  address: string;
  symbol: string;
  name: string;
  holders: number | null;
  totalSupply: string | null;
  decimals: number | null;
  type: string | null;
};
