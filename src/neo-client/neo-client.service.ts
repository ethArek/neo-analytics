import { api } from '@cityofzion/dora-ts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NeoClient,
  NeoInvocation,
  NeoPagedResponse,
  NeoTransaction,
  NeoTransfer,
} from './neo-client.interface';
import type {
  BlockRange,
  DoraAssetResponse,
  DoraHeightResponse,
  DoraRestConfig,
  RpcApplicationLog,
  RpcBlock,
  RpcBlockHeader,
  RpcBlockSummary,
  RpcBlocksResponse,
  RpcClient,
  RpcContractState,
  RpcStackItem,
} from './neo-client.service.types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NEO_HASH = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
const GAS_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';

@Injectable()
export class RpcNeoClient implements NeoClient {
  private readonly logger = new Logger(RpcNeoClient.name);
  private readonly rpcClients: RpcClient[];
  private readonly doraNetwork: 'mainnet' | 'testnet';
  private readonly rateLimitMs = 50;
  private readonly maxRetries = 3;
  private readonly pageSize = 8;
  private readonly blocksDefaultPageSize = 15;
  private readonly dateBlockRangeCache = new Map<string, BlockRange>();
  private readonly blockTimeCache = new Map<number, number>();
  private readonly blocksPageCache = new Map<number, RpcBlockSummary[]>();
  private nativeAssetMap?: Map<string, string>;
  private clientIndex = 0;
  private blocksPageSize = this.blocksDefaultPageSize;
  private blocksPageSizeResolved = false;
  private readonly assetLabelCache = new Map<string, string>();
  private readonly assetLabelInFlight = new Map<string, Promise<string>>();
  private readonly assetDecimalsCache = new Map<string, number>();
  private readonly assetDecimalsInFlight = new Map<string, Promise<number | null>>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.doraNetwork = this.resolveDoraNetwork(this.configService.get<string>('app.neoNetwork'));
    const endpoints = this.configService.get<string[]>('app.doraApiUrls') ?? [];
    if (endpoints.length === 0) {
      this.rpcClients = [new api.NeoRESTApi()];
      return;
    }

    this.rpcClients = endpoints.map(
      (endpoint) => new api.NeoRESTApi(this.toDoraRestConfig(endpoint)),
    );
  }

  async fetchTransactionsForDay(date: string, cursor?: string): Promise<NeoPagedResponse> {
    const range = await this.getBlockRangeForDate(date);
    if (!range) {
      return { transactions: [] };
    }

    const response = await this.fetchTransactionsForBlockRange(range, date, cursor);

    return response;
  }

  async fetchTransactionsForRange(
    startTime: Date,
    endTime: Date,
    cursor?: string,
  ): Promise<NeoPagedResponse> {
    const range = await this.getBlockRangeForTimeRange(startTime.getTime(), endTime.getTime());
    if (!range) {
      return { transactions: [] };
    }

    const label = `${startTime.toISOString()} - ${endTime.toISOString()}`;
    const response = await this.fetchTransactionsForBlockRange(range, label, cursor);

    return response;
  }

  async resolveAssetLabel(asset: string): Promise<string | null> {
    const trimmed = asset.trim();
    if (!trimmed) {
      return null;
    }

    const upper = trimmed.toUpperCase();
    if (upper === 'NEO' || upper === 'GAS') {
      return upper;
    }

    const normalized = this.normalizeHash(trimmed);
    if (!this.isHash(normalized)) {
      return trimmed;
    }

    const cached = this.assetLabelCache.get(normalized);
    if (cached) {
      return cached;
    }

    const inFlight = this.assetLabelInFlight.get(normalized);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.fetchAssetLabel(normalized).finally(() => {
      this.assetLabelInFlight.delete(normalized);
    });
    this.assetLabelInFlight.set(normalized, promise);

    return promise;
  }

  async resolveAssetDecimals(asset: string): Promise<number | null> {
    const trimmed = asset.trim();
    if (!trimmed) {
      return null;
    }

    const upper = trimmed.toUpperCase();
    if (upper === 'NEO') {
      return 0;
    }

    if (upper === 'GAS') {
      return 8;
    }

    const normalized = this.normalizeHash(trimmed);
    if (!this.isHash(normalized)) {
      return null;
    }

    const cached = this.assetDecimalsCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    const inFlight = this.assetDecimalsInFlight.get(normalized);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.fetchAssetDecimals(normalized).finally(() => {
      this.assetDecimalsInFlight.delete(normalized);
    });
    this.assetDecimalsInFlight.set(normalized, promise);

    return promise;
  }

  private async fetchTransactionsForBlockRange(
    range: BlockRange,
    label: string,
    cursor?: string,
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
        } for ${label} (${blockTransactions.length} tx).`,
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
            applicationLog,
            tx,
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

  private async fetchAssetLabel(assetHash: string): Promise<string> {
    const symbol = await this.fetchTokenSymbol(assetHash);
    if (symbol) {
      this.assetLabelCache.set(assetHash, symbol);
      return symbol;
    }

    const name = await this.fetchContractName(assetHash);
    if (name) {
      this.assetLabelCache.set(assetHash, name);
      return name;
    }

    this.assetLabelCache.set(assetHash, assetHash);

    return assetHash;
  }

  private async fetchAssetDecimals(assetHash: string): Promise<number | null> {
    try {
      const asset = await this.withRpc((client) => client.asset(assetHash, this.doraNetwork));
      const raw = (asset as DoraAssetResponse).decimals;
      const decimals = typeof raw === 'number' ? Math.floor(raw) : Number.parseInt(String(raw), 10);
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 30) {
        return null;
      }

      this.assetDecimalsCache.set(assetHash, decimals);

      return decimals;
    } catch (_error) {
      return null;
    }
  }

  private async fetchTokenSymbol(assetHash: string): Promise<string | null> {
    try {
      const asset = await this.withRpc((client) => client.asset(assetHash, this.doraNetwork));
      const symbol = (asset as DoraAssetResponse).symbol;
      if (typeof symbol !== 'string') {
        return null;
      }

      const trimmed = symbol.trim();
      if (!trimmed) {
        return null;
      }

      return trimmed;
    } catch (_error) {
      return null;
    }
  }

  private async fetchContractName(assetHash: string): Promise<string | null> {
    try {
      const state = await this.withRpc((client) => client.contract(assetHash, this.doraNetwork));
      const name = (state as RpcContractState)?.manifest?.name;
      if (typeof name !== 'string') {
        return null;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        return null;
      }

      return trimmed;
    } catch (_error) {
      return null;
    }
  }

  private async getBlockRangeForDate(date: string): Promise<BlockRange | null> {
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
    endTime: number,
  ): Promise<BlockRange | null> {
    if (startTime > endTime) {
      return null;
    }

    const blockCount = await this.getBlockCount();
    if (blockCount === 0) {
      return null;
    }

    const latestIndex = blockCount - 1;
    await this.ensureBlocksPageSize();
    const startIndex = await this.findFirstBlockAtOrAfter(startTime, 0, latestIndex, latestIndex);
    const endIndex = await this.findLastBlockAtOrBefore(endTime, 0, latestIndex, latestIndex);

    if (startIndex === null || endIndex === null || startIndex > endIndex) {
      return null;
    }

    return { start: startIndex, end: endIndex };
  }

  private async findFirstBlockAtOrAfter(
    targetTime: number,
    low: number,
    high: number,
    latestIndex: number,
  ): Promise<number | null> {
    let result: number | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const time = await this.getBlockTime(mid, latestIndex);

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
    high: number,
    latestIndex: number,
  ): Promise<number | null> {
    let result: number | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const time = await this.getBlockTime(mid, latestIndex);

      if (time <= targetTime) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  private async getBlockTime(index: number, latestIndex: number): Promise<number> {
    const cached = this.blockTimeCache.get(index);
    if (cached !== undefined) {
      return cached;
    }

    const summaryTime = await this.getBlockTimeFromBlocks(index, latestIndex);
    if (summaryTime !== null) {
      this.blockTimeCache.set(index, summaryTime);
      return summaryTime;
    }

    const header = await this.getBlockHeader(index);

    const headerTime = this.toTimestampMs(header.time);
    this.blockTimeCache.set(index, headerTime);

    return headerTime;
  }

  private async ensureBlocksPageSize(): Promise<void> {
    if (this.blocksPageSizeResolved) {
      return;
    }

    const firstPage = await this.getBlocksPage(1);
    if (firstPage.length > 0) {
      this.blocksPageSize = firstPage.length;
    }

    this.blocksPageSizeResolved = true;
  }

  private async getBlockTimeFromBlocks(index: number, latestIndex: number): Promise<number | null> {
    if (index < 0 || index > latestIndex) {
      return null;
    }

    try {
      const pageNumber = this.getBlocksPageNumberForIndex(index, latestIndex);
      const page = await this.getBlocksPage(pageNumber);
      const block = page.find((item) => this.toNumber(item.index) === index);
      if (!block) {
        return null;
      }

      const blockTime = this.toTimestampMs(block.time);

      return blockTime;
    } catch (_error) {
      return null;
    }
  }

  private getBlocksPageNumberForIndex(index: number, latestIndex: number): number {
    const blocksFromTip = latestIndex - index;
    if (blocksFromTip <= 0) {
      return 1;
    }

    return Math.floor(blocksFromTip / this.blocksPageSize) + 1;
  }

  private async getBlocksPage(pageNumber: number): Promise<RpcBlockSummary[]> {
    const cached = this.blocksPageCache.get(pageNumber);
    if (cached) {
      return cached;
    }

    const response = await this.withRpc((client) => client.blocks(pageNumber, this.doraNetwork));
    const items = (response as RpcBlocksResponse).items;
    const page: RpcBlockSummary[] = [];
    if (Array.isArray(items)) {
      for (const item of items) {
        page.push(item);
        const index = this.toNumber(item.index);
        if (Number.isFinite(index)) {
          const blockTime = this.toTimestampMs(item.time);
          this.blockTimeCache.set(index, blockTime);
        }
      }
    }

    this.blocksPageCache.set(pageNumber, page);

    return page;
  }

  private async getBlockHeader(index: number): Promise<RpcBlockHeader> {
    const block = await this.getBlock(index);

    return {
      index: block.index,
      time: block.time,
    };
  }

  private async getBlock(index: number): Promise<RpcBlock> {
    const block = await this.withRpc((client) => client.block(index, this.doraNetwork));

    return block as RpcBlock;
  }

  private async getBlockCount(): Promise<number> {
    const response = await this.withRpc((client) => client.height(this.doraNetwork));
    const count = this.toNumber((response as DoraHeightResponse).height ?? 0);
    if (!Number.isFinite(count) || count < 0) {
      return 0;
    }

    return Math.floor(count);
  }

  private async getApplicationLog(txid: string): Promise<RpcApplicationLog> {
    const log = await this.withRpc((client) => client.log(txid, this.doraNetwork));

    return log as unknown as RpcApplicationLog;
  }

  private extractTransfers(log: RpcApplicationLog, assetMap: Map<string, string>): NeoTransfer[] {
    const executions = log.executions ?? [];
    const executionNotifications = executions.flatMap((execution) => execution.notifications ?? []);
    const notifications =
      executionNotifications.length > 0 ? executionNotifications : (log.notifications ?? []);
    const transfers: NeoTransfer[] = [];

    for (const notification of notifications) {
      const eventName = notification.eventname ?? notification.event_name;
      if (eventName !== 'Transfer') {
        continue;
      }

      if (!notification.state) {
        continue;
      }

      const state = this.toStackItem(notification.state);
      const items = this.readArray(state);
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

  private extractInvocationFromScript(script: string): NeoInvocation | undefined {
    const bytes = this.decodeScriptBytes(script);
    if (!bytes || bytes.length === 0) {
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
          lastContract = `0x${data.toString('hex')}`;
        }

        continue;
      }

      if (opcode === 0x68) {
        const syscallLength = bytes[offset];
        offset += 1;
        const syscall = bytes.slice(offset, offset + syscallLength).toString('utf8');
        offset += syscallLength;

        if (syscall.startsWith('System.Contract.Call')) {
          if (lastString) {
            return {
              contract: lastContract ?? '',
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

    const hexCandidate = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
    if (
      hexCandidate.length > 0 &&
      hexCandidate.length % 2 === 0 &&
      /^[0-9a-f]+$/i.test(hexCandidate)
    ) {
      return Buffer.from(hexCandidate, 'hex');
    }

    const base64Candidate = trimmed.replace(/\s+/g, '');
    if (
      base64Candidate.length > 0 &&
      base64Candidate.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+=*$/.test(base64Candidate)
    ) {
      const decoded = Buffer.from(base64Candidate, 'base64');
      if (decoded.length > 0) {
        return decoded;
      }
    }

    return null;
  }

  private toStackItem(value: RpcStackItem | RpcStackItem[]): RpcStackItem {
    if (Array.isArray(value)) {
      return {
        type: 'Array',
        value,
      };
    }

    return value;
  }

  private readPushDataLength(
    buffer: Buffer,
    opcode: number,
    offset: number,
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
    const text = data.toString('utf8');
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
    if (item.type === 'Array' || item.type === 'Struct') {
      if (Array.isArray(item.value)) {
        const result: RpcStackItem[] = [];
        for (const stackItem of item.value) {
          if (!this.isStackItem(stackItem)) {
            return null;
          }

          result.push(stackItem);
        }

        return result;
      }
    }

    return null;
  }

  private isStackItem(value: unknown): value is RpcStackItem {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (!('type' in value)) {
      return false;
    }

    const candidate = value as { type?: unknown };

    return typeof candidate.type === 'string';
  }

  private readAddress(item: RpcStackItem): string | undefined {
    if (item.type === 'Any' && (item.value === null || item.value === undefined)) {
      return undefined;
    }

    if (item.type !== 'ByteString') {
      return undefined;
    }

    if (typeof item.value !== 'string') {
      return undefined;
    }

    const bytes = Buffer.from(item.value, 'base64');
    if (bytes.length === 0) {
      return '';
    }

    return `0x${bytes.toString('hex')}`;
  }

  private readInteger(item: RpcStackItem): string | undefined {
    if (item.type !== 'Integer') {
      return undefined;
    }

    if (typeof item.value !== 'string' && typeof item.value !== 'number') {
      return undefined;
    }

    return String(item.value);
  }

  private isHash(value: string): boolean {
    return /^0x[0-9a-f]{40}$/i.test(value);
  }

  private normalizeHash(hash: string): string {
    const normalized = hash.toLowerCase();
    if (normalized.startsWith('0x')) {
      return normalized;
    }

    return `0x${normalized}`;
  }

  private toNumber(value: number | string): number {
    if (typeof value === 'number') {
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
      [NEO_HASH, 'NEO'],
      [GAS_HASH, 'GAS'],
    ]);

    this.nativeAssetMap = map;

    return map;
  }

  private resolveDoraNetwork(network?: string): 'mainnet' | 'testnet' {
    const normalized = network?.trim().toLowerCase() ?? '';
    if (normalized.includes('test')) {
      return 'testnet';
    }

    return 'mainnet';
  }

  private toDoraRestConfig(endpoint: string): DoraRestConfig {
    const normalized = endpoint.trim().replace(/\/+$/, '');
    if (!normalized) {
      return { url: 'https://api.coz.io', endpoint: '/api/v2/neo3' };
    }

    if (normalized.endsWith('/api/v2/neo3')) {
      return {
        url: normalized.slice(0, -'/api/v2/neo3'.length),
        endpoint: '/api/v2/neo3',
      };
    }

    if (normalized.endsWith('/api/v2')) {
      return {
        url: normalized.slice(0, -'/api/v2'.length),
        endpoint: '/api/v2/neo3',
      };
    }

    if (normalized.endsWith('/api')) {
      return {
        url: normalized.slice(0, -'/api'.length),
        endpoint: '/api/v2/neo3',
      };
    }

    return {
      url: normalized,
      endpoint: '/api/v2/neo3',
    };
  }

  private async withRpc<T>(action: (client: RpcClient) => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      for (let offset = 0; offset < this.rpcClients.length; offset += 1) {
        const client = this.rpcClients[(this.clientIndex + offset) % this.rpcClients.length];
        try {
          const result = await action(client);
          this.clientIndex = (this.clientIndex + offset + 1) % this.rpcClients.length;

          if (this.rateLimitMs > 0) {
            await sleep(this.rateLimitMs);
          }

          return result;
        } catch (error) {
          lastError = error as Error;
        }
      }

      const wait = 2 ** attempt * 200;
      this.logger.warn(`Dora API call failed (attempt ${attempt + 1}). Retrying in ${wait}ms.`);
      await sleep(wait);
      attempt += 1;
    }

    throw lastError ?? new Error('Dora API request failed');
  }
}
