import { rpc } from "@cityofzion/neon-js";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NeoClient,
  NeoInvocation,
  NeoPagedResponse,
  NeoTransaction,
  NeoTransfer,
} from "./neo-client.interface";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

type RpcClient = InstanceType<typeof rpc.RPCClient>;

type RpcBlock = {
  index: number | string;
  time: number | string;
  tx?: RpcTransaction[];
  transactions?: RpcTransaction[];
};

type RpcBlockHeader = {
  index: number | string;
  time: number | string;
};

type RpcTransaction = {
  hash: string;
  script?: string;
};

type RpcApplicationLog = {
  executions?: RpcExecution[];
};

type RpcExecution = {
  notifications?: RpcNotification[];
};

type RpcNotification = {
  contract: string;
  eventname: string;
  state: RpcStackItem;
};

type RpcStackItem = {
  type: string;
  value?: unknown;
};

type RpcNativeContract = {
  name?: string;
  hash?: string;
};

@Injectable()
export class RpcNeoClient implements NeoClient {
  private readonly logger = new Logger(RpcNeoClient.name);
  private readonly rpcClients: RpcClient[];
  private readonly rateLimitMs = 50;
  private readonly maxRetries = 3;
  private readonly pageSize = 8;
  private readonly dateBlockRangeCache = new Map<
    string,
    { start: number; end: number }
  >();
  private nativeAssetMap?: Map<string, string>;
  private clientIndex = 0;

  constructor(private readonly configService: ConfigService) {
    const endpoints =
      this.configService.get<string[]>("app.rpcEndpoints") ?? [];
    if (endpoints.length === 0) {
      throw new Error("RPC_ENDPOINT_1 or RPC_ENDPOINT_2 is not configured");
    }

    this.rpcClients = endpoints.map((endpoint) => new rpc.RPCClient(endpoint));
  }

  async fetchTransactionsForDay(
    date: string,
    cursor?: string
  ): Promise<NeoPagedResponse> {
    const range = await this.getBlockRangeForDate(date);
    console.log(range);
    if (!range) {

      return { transactions: [] };
    }

    const response = await this.fetchTransactionsForBlockRange(range, date, cursor);

    return response;
  }

  async fetchTransactionsForRange(
    startTime: Date,
    endTime: Date,
    cursor?: string
  ): Promise<NeoPagedResponse> {
    const range = await this.getBlockRangeForTimeRange(
      startTime.getTime(),
      endTime.getTime()
    );
    if (!range) {

      return { transactions: [] };
    }

    const label = `${startTime.toISOString()} - ${endTime.toISOString()}`;
    const response = await this.fetchTransactionsForBlockRange(
      range,
      label,
      cursor
    );

    return response;
  }

  private async fetchTransactionsForBlockRange(
    range: { start: number; end: number },
    label: string,
    cursor?: string
  ): Promise<NeoPagedResponse> {
    const startIndex = cursor ? Number(cursor) : range.start;
    if (Number.isNaN(startIndex) || startIndex > range.end) {

      return { transactions: [] };
    }

    const endIndex = Math.min(startIndex + this.pageSize - 1, range.end);
    const transactions: NeoTransaction[] = [];
    const assetMap = await this.getNativeAssetMap();

    for (let index = startIndex; index <= endIndex; index += 1) {
      const block = await this.getBlock(index);
      const blockIndex = this.toNumber(block.index);
      const blockTime = this.toTimestampMs(block.time);
      const blockTimeIso = new Date(blockTime).toISOString();
      const blockTransactions = block.tx ?? block.transactions ?? [];
      this.logger.log(
        `Fetched block ${
          Number.isFinite(blockIndex) ? blockIndex : index
        } for ${label} (${blockTransactions.length} tx).`
      );

      for (const tx of blockTransactions) {
        const applicationLog = await this.getApplicationLog(tx.hash);
        const transfers = this.extractTransfers(applicationLog, assetMap);
        const invocation = this.extractInvocation(tx.script);

        transactions.push({
          txid: tx.hash,
          timestamp: blockTimeIso,
          blockIndex,
          transfers,
          invocation,
          raw: {
            blockIndex,
            blockTime,
            tx,
            applicationLog,
          },
        });
      }
    }

    const nextCursor = endIndex < range.end ? String(endIndex + 1) : undefined;

    return {
      transactions,
      nextCursor,
      lastBlockIndex: endIndex,
      blockStart: range.start,
      blockEnd: range.end,
    };
  }

  private async getBlockRangeForDate(
    date: string
  ): Promise<{ start: number; end: number } | null> {
    const cached = this.dateBlockRangeCache.get(date);
    if (cached) {

      return cached;
    }

    const startTime = Date.parse(`${date}T00:00:00.000Z`);
    const endTime = Date.parse(`${date}T23:59:59.999Z`);
    const range = await this.getBlockRangeForTimeRange(startTime, endTime);
    if (!range) {

      return null;
    }

    this.dateBlockRangeCache.set(date, range);

    return range;
  }

  private async getBlockRangeForTimeRange(
    startTime: number,
    endTime: number
  ): Promise<{ start: number; end: number } | null> {
    if (startTime > endTime) {

      return null;
    }

    const blockCount = await this.getBlockCount();
    if (blockCount === 0) {

      return null;
    }

    const latestIndex = blockCount - 1;
    const startIndex = await this.findFirstBlockAtOrAfter(
      startTime,
      0,
      latestIndex
    );
    const endIndex = await this.findLastBlockAtOrBefore(
      endTime,
      0,
      latestIndex
    );

    if (startIndex === null || endIndex === null || startIndex > endIndex) {

      return null;
    }

    return { start: startIndex, end: endIndex };
  }

  private async findFirstBlockAtOrAfter(
    targetTime: number,
    low: number,
    high: number
  ): Promise<number | null> {
    let result: number | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const time = await this.getBlockTime(mid);

      if (time >= targetTime) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return result;
  }

  private async findLastBlockAtOrBefore(
    targetTime: number,
    low: number,
    high: number
  ): Promise<number | null> {
    let result: number | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const time = await this.getBlockTime(mid);

      if (time <= targetTime) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  private async getBlockTime(index: number): Promise<number> {
    const header = await this.getBlockHeader(index);

    const headerTime = this.toTimestampMs(header.time);

    return headerTime;
  }

  private async getBlockHeader(index: number): Promise<RpcBlockHeader> {
    const header = await this.withRpc((client) =>
      client.getBlockHeader(index, 1)
    );

    return header as RpcBlockHeader;
  }

  private async getBlock(index: number): Promise<RpcBlock> {
    const block = await this.withRpc((client) => client.getBlock(index, 1));

    return block as RpcBlock;
  }

  private async getBlockCount(): Promise<number> {
    const count = await this.withRpc((client) => client.getBlockCount());

    return count as number;
  }

  private async getApplicationLog(txid: string): Promise<RpcApplicationLog> {
    const log = await this.withRpc((client) => client.getApplicationLog(txid));

    return log as RpcApplicationLog;
  }

  private extractTransfers(
    log: RpcApplicationLog,
    assetMap: Map<string, string>
  ): NeoTransfer[] {
    const executions = log.executions ?? [];
    const notifications = executions.flatMap(
      (execution) => execution.notifications ?? []
    );
    const transfers: NeoTransfer[] = [];

    for (const notification of notifications) {
      if (notification.eventname !== "Transfer") {
        continue;
      }

      const items = this.readArray(notification.state);
      if (!items || items.length < 3) {
        continue;
      }

      const from = this.readAddress(items[0]);
      const to = this.readAddress(items[1]);
      const amount = this.readInteger(items[2]);
      const assetHash = this.normalizeHash(notification.contract);
      const asset = assetMap.get(assetHash) ?? assetHash;

      transfers.push({
        from,
        to,
        amount,
        asset,
      });
    }

    return transfers;
  }

  private extractInvocation(script?: string): NeoInvocation | undefined {
    if (!script) {
      return undefined;
    }

    const result = this.extractInvocationFromScript(script);
    if (!result) {
      return undefined;
    }

    return result;
  }

  private extractInvocationFromScript(
    script: string
  ): NeoInvocation | undefined {
    const bytes = this.decodeScriptBytes(script);
    if (!bytes) {

      return undefined;
    }
    let offset = 0;
    let lastString: string | undefined;
    let lastContract: string | undefined;

    while (offset < bytes.length) {
      const opcode = bytes[offset];
      offset += 1;

      const dataLength = this.readPushDataLength(bytes, opcode, offset);
      if (dataLength !== null) {
        const { length, skip } = dataLength;
        offset += skip;
        const data = bytes.slice(offset, offset + length);
        offset += length;

        const decoded = this.decodeAscii(data);
        if (decoded) {
          lastString = decoded;
        } else if (data.length === 20) {
          lastContract = `0x${data.toString("hex")}`;
        }

        continue;
      }

      if (opcode === 0x68) {
        const syscallLength = bytes[offset];
        offset += 1;
        const syscall = bytes
          .slice(offset, offset + syscallLength)
          .toString("utf8");
        offset += syscallLength;

        if (syscall.startsWith("System.Contract.Call")) {
          if (lastString) {
            return {
              contract: lastContract ?? "",
              method: lastString,
            };
          }
        }
      }
    }

    return undefined;
  }

  private decodeScriptBytes(script: string): Buffer | null {
    const trimmed = script.trim();
    if (!trimmed) {

      return null;
    }

    const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
    if (isHex && trimmed.length % 2 === 0) {

      return Buffer.from(trimmed, "hex");
    }

    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 0) {

      return null;
    }

    return decoded;
  }

  private readPushDataLength(
    buffer: Buffer,
    opcode: number,
    offset: number
  ): { length: number; skip: number } | null {
    if (opcode >= 0x01 && opcode <= 0x4b) {
      return { length: opcode, skip: 0 };
    }

    if (opcode === 0x0c) {
      const length = buffer[offset];

      return { length, skip: 1 };
    }

    if (opcode === 0x0d) {
      const length = buffer.readUInt16LE(offset);

      return { length, skip: 2 };
    }

    if (opcode === 0x0e) {
      const length = buffer.readUInt32LE(offset);

      return { length, skip: 4 };
    }

    return null;
  }

  private decodeAscii(data: Buffer): string | undefined {
    const text = data.toString("utf8");
    if (!text) {
      return undefined;
    }

    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) {
        return undefined;
      }
    }

    return text;
  }

  private readArray(item: RpcStackItem): RpcStackItem[] | null {
    if (item.type === "Array" || item.type === "Struct") {
      if (Array.isArray(item.value)) {
        return item.value as RpcStackItem[];
      }
    }

    return null;
  }

  private readAddress(item: RpcStackItem): string | undefined {
    if (
      item.type === "Any" &&
      (item.value === null || item.value === undefined)
    ) {
      return undefined;
    }

    if (item.type !== "ByteString") {
      return undefined;
    }

    if (typeof item.value !== "string") {
      return undefined;
    }

    const bytes = Buffer.from(item.value, "base64");
    if (bytes.length === 0) {
      return "";
    }

    return `0x${bytes.toString("hex")}`;
  }

  private readInteger(item: RpcStackItem): string | undefined {
    if (item.type !== "Integer") {
      return undefined;
    }

    if (typeof item.value !== "string" && typeof item.value !== "number") {
      return undefined;
    }

    return String(item.value);
  }

  private normalizeHash(hash: string): string {
    const normalized = hash.toLowerCase();
    if (normalized.startsWith("0x")) {
      return normalized;
    }

    return `0x${normalized}`;
  }

  private toNumber(value: number | string): number {
    if (typeof value === "number") {
      return value;
    }

    return Number(value);
  }

  private toTimestampMs(value: number | string): number {
    const numeric = this.toNumber(value);
    if (!Number.isFinite(numeric)) {

      return 0;
    }

    if (numeric > 1_000_000_000_000) {

      return Math.floor(numeric);
    }

    return Math.floor(numeric * 1000);
  }

  private async getNativeAssetMap(): Promise<Map<string, string>> {
    if (this.nativeAssetMap) {

      return this.nativeAssetMap;
    }

    const map = new Map<string, string>([
      [NEO_HASH, "NEO"],
      [GAS_HASH, "GAS"],
    ]);

    const contracts = await this.withRpc((client) =>
      client.getNativeContracts()
    );

    if (Array.isArray(contracts)) {
      for (const contract of contracts) {
        const typed = contract as RpcNativeContract;
        const name = typed.name?.toLowerCase();
        const hash = typed.hash ? this.normalizeHash(typed.hash) : undefined;

        if (!hash || !name) {
          continue;
        }

        if (name === "neotoken") {
          map.set(hash, "NEO");
        }

        if (name === "gastoken") {
          map.set(hash, "GAS");
        }
      }
    }

    this.nativeAssetMap = map;

    return map;
  }

  private async withRpc<T>(
    action: (client: RpcClient) => Promise<T>
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      for (let offset = 0; offset < this.rpcClients.length; offset += 1) {
        const client =
          this.rpcClients[(this.clientIndex + offset) % this.rpcClients.length];
        try {
          const result = await action(client);
          this.clientIndex =
            (this.clientIndex + offset + 1) % this.rpcClients.length;

          if (this.rateLimitMs > 0) {
            await sleep(this.rateLimitMs);
          }

          return result;
        } catch (error) {
          lastError = error as Error;
        }
      }

      const wait = Math.pow(2, attempt) * 200;
      this.logger.warn(
        `RPC call failed (attempt ${attempt + 1}). Retrying in ${wait}ms.`
      );
      await sleep(wait);
      attempt += 1;
    }

    throw lastError ?? new Error("RPC request failed");
  }
}
