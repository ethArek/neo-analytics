import type { api } from '@cityofzion/dora-ts';

export type RpcClient = InstanceType<typeof api.NeoRESTApi>;

export type BlockRange = {
  start: number;
  end: number;
};

export type DoraRestConfig = {
  url: string;
  endpoint: string;
};

export type RpcTransaction = {
  hash: string;
  script?: string;
};

export type RpcBlock = {
  index: number | string;
  time: number | string;
  tx?: RpcTransaction[];
  transactions?: RpcTransaction[];
};

export type RpcBlockSummary = {
  index: number | string;
  time: number | string;
};

export type RpcBlocksResponse = {
  items?: RpcBlockSummary[];
};

export type RpcBlockHeader = {
  index: number | string;
  time: number | string;
};

export type RpcExecution = {
  notifications?: RpcNotification[];
};

export type RpcNotification = {
  contract: string;
  eventname?: string;
  event_name?: string;
  state?: RpcStackItem | RpcStackItem[];
};

export type RpcApplicationLog = {
  executions?: RpcExecution[];
  notifications?: RpcNotification[];
};

export type RpcStackItem = {
  type: string;
  value?: unknown;
};

export type RpcContractState = {
  manifest?: { name?: string };
};

export type DoraHeightResponse = {
  height?: number | string;
};

export type DoraAssetResponse = {
  symbol?: string;
  decimals?: number | string;
};
