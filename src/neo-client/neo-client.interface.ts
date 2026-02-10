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
  blockStart?: number;
  blockEnd?: number;
};

export interface NeoClient {
  fetchTransactionsForDay(date: string, cursor?: string): Promise<NeoPagedResponse>;
  fetchTransactionsForRange?(
    startTime: Date,
    endTime: Date,
    cursor?: string,
  ): Promise<NeoPagedResponse>;
  resolveAssetLabel?(asset: string): Promise<string | null>;
}
