export type NeoInvocation = {
  contract: string;
  method: string;
};

export type NeoTransfer = {
  from?: string;
  to?: string;
  amount?: string;
  asset?: 'NEO' | 'GAS' | string;
};

export type NeoTransaction = {
  txid: string;
  timestamp: string;
  blockIndex?: number;
  transfers?: NeoTransfer[];
  invocation?: NeoInvocation;
  raw: Record<string, unknown>;
};

export type NeoPagedResponse = {
  transactions: NeoTransaction[];
  nextCursor?: string;
  lastBlockIndex?: number;
};

export interface NeoClient {
  fetchTransactionsForDay(date: string, cursor?: string): Promise<NeoPagedResponse>;
}
