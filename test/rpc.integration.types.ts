export type DoraTransaction = {
  hash: string;
  script?: string;
};

export type DoraTransactionDetails = {
  hash: string;
  script?: string;
  block: number | string;
};

export type DoraBlock = {
  index: number | string;
  tx?: DoraTransaction[];
  transactions?: DoraTransaction[];
};

export type DoraNotification = {
  eventname?: string;
  event_name?: string;
  state?: unknown;
};

export type DoraLog = {
  txid: string;
  notifications: DoraNotification[];
};

export type CsvTxRow = {
  dayLabel: string;
  txid: string;
  blockIndex: number | null;
  transferCount: number;
  timestampUtc: string;
  type: string;
  method: string;
  contract: string;
};

export type RecentTransactionSample = {
  block: DoraBlock;
  tx: DoraTransaction;
};
