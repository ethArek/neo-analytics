import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtlCache } from '../common/cache.utils';
import { getConfigUrl } from '../common/config.utils';
import { fetchWithTimeout } from '../common/fetch.utils';
import { normalizeHash } from '../common/normalize.utils';
import type {
  NeoXAddressInfo,
  NeoXNetworkStats,
  NeoXRecentTransaction,
  NeoXToken,
  NeoXTransactionChartPoint,
} from './neo-x.service.types';

const NETWORK_STATS_CACHE_TTL_MS = 15 * 1000;
const TRANSACTION_CHART_CACHE_TTL_MS = 30 * 1000;
const RECENT_TRANSACTIONS_CACHE_TTL_MS = 15 * 1000;
const TOKENS_CACHE_TTL_MS = 60 * 1000;

type NeoXCachedValue<T> = {
  value: T;
  cacheable: boolean;
};

@Injectable()
export class NeoXService {
  private readonly logger = new Logger(NeoXService.name);
  private readonly requestTimeoutMs = 8000;
  private readonly networkStatsCache = new TtlCache<NeoXNetworkStats | null>();
  private readonly transactionChartCache = new TtlCache<NeoXTransactionChartPoint[]>();
  private readonly recentTransactionsCache = new TtlCache<NeoXRecentTransaction[]>();
  private readonly tokensCache = new TtlCache<NeoXToken[]>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async getNetworkStats(): Promise<NeoXNetworkStats | null> {
    return this.getCachedValue(
      this.networkStatsCache,
      async () => {
        const url = this.buildApiUrl('/stats');
        if (!url) {
          return {
            value: null,
            cacheable: false,
          };
        }

        try {
          const payload = await this.fetchNeoXJson<unknown>(url);

          return {
            value: this.normalizeNetworkStats(payload),
            cacheable: true,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load Neo X network stats (${reason}). Continuing without Neo X summary metrics.`,
          );

          return {
            value: null,
            cacheable: false,
          };
        }
      },
      NETWORK_STATS_CACHE_TTL_MS,
    );
  }

  async getTransactionChart(): Promise<NeoXTransactionChartPoint[]> {
    return this.getCachedValue(
      this.transactionChartCache,
      async () => {
        const url = this.buildApiUrl('/stats/charts/transactions');
        if (!url) {
          return {
            value: [],
            cacheable: false,
          };
        }

        try {
          const payload = await this.fetchNeoXJson<unknown>(url);

          return {
            value: this.normalizeTransactionChart(payload),
            cacheable: true,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load Neo X transaction history (${reason}). Continuing without Neo X charts.`,
          );

          return {
            value: [],
            cacheable: false,
          };
        }
      },
      TRANSACTION_CHART_CACHE_TTL_MS,
    );
  }

  async getRecentTransactions(limit = 6): Promise<NeoXRecentTransaction[]> {
    const transactions = await this.getCachedValue(
      this.recentTransactionsCache,
      async () => {
        const url = this.buildApiUrl('/main-page/transactions');
        if (!url) {
          return {
            value: [],
            cacheable: false,
          };
        }

        try {
          const payload = await this.fetchNeoXJson<unknown>(url);

          return {
            value: this.normalizeRecentTransactions(payload),
            cacheable: true,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load Neo X recent transactions (${reason}). Continuing without Neo X recent activity list.`,
          );

          return {
            value: [],
            cacheable: false,
          };
        }
      },
      RECENT_TRANSACTIONS_CACHE_TTL_MS,
    );

    return transactions.slice(0, limit);
  }

  async getTopTokens(limit = 6): Promise<NeoXToken[]> {
    const tokens = await this.getCachedValue(
      this.tokensCache,
      async () => {
        const baseUrl = this.buildApiUrl('/tokens');
        if (!baseUrl) {
          return {
            value: [],
            cacheable: false,
          };
        }

        const url = new URL(baseUrl);
        url.searchParams.set('type', 'ERC-20');

        try {
          const payload = await this.fetchNeoXJson<unknown>(url.toString());

          return {
            value: this.normalizeTokens(payload),
            cacheable: true,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load Neo X token list (${reason}). Continuing without token coverage listings.`,
          );

          return {
            value: [],
            cacheable: false,
          };
        }
      },
      TOKENS_CACHE_TTL_MS,
    );

    return tokens.slice(0, limit);
  }

  private async getCachedValue<T>(
    cache: TtlCache<T>,
    loader: () => Promise<NeoXCachedValue<T>>,
    ttlMs: number,
  ): Promise<T> {
    const cached = cache.get();
    if (cached.kind === 'hit') {
      return cached.value;
    }

    const existingPromise = cache.getPromise();
    if (existingPromise) {
      return existingPromise;
    }

    const request = (async () => {
      const result = await loader();
      if (result.cacheable) {
        cache.set(result.value, ttlMs);
      }

      return result.value;
    })();
    cache.setPromise(request);

    try {
      return await request;
    } finally {
      cache.setPromise(null);
    }
  }

  private async fetchNeoXJson<T>(url: string): Promise<T> {
    return fetchWithTimeout<T>(url, this.requestTimeoutMs, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  }

  private buildApiUrl(path: string): string | null {
    const baseUrl = getConfigUrl(this.configService, 'app.neoXExplorerApiUrl');
    if (!baseUrl) {
      return null;
    }

    return `${baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private normalizeTransactionHistoryPoints(points: unknown[]): NeoXTransactionChartPoint[] {
    const normalized: NeoXTransactionChartPoint[] = [];

    for (const item of points) {
      const row = this.asRecord(item);
      const date = this.parseString(row?.date);
      const txCount = this.parseInteger(row?.txCount ?? row?.tx_count);
      if (!date || txCount === null) {
        continue;
      }

      normalized.push({
        date,
        txCount,
      });
    }

    return normalized.sort((left, right) => left.date.localeCompare(right.date));
  }

  private normalizeNetworkStats(payload: unknown): NeoXNetworkStats | null {
    const root = this.asRecord(payload);
    if (!root) {
      return null;
    }

    return {
      averageBlockTimeMs: this.parseNumber(root.average_block_time),
      averageGasPriceGwei: this.parseNumber(this.asRecord(root.gas_prices)?.average),
      gasUsedToday: this.parseString(root.gas_used_today),
      totalAddresses: this.parseInteger(root.total_addresses),
      totalBlocks: this.parseInteger(root.total_blocks),
      totalTransactions: this.parseInteger(root.total_transactions),
      transactionsToday: this.parseInteger(root.transactions_today),
    };
  }

  private normalizeTransactionChart(payload: unknown): NeoXTransactionChartPoint[] {
    const root = this.asRecord(payload);
    const chartData = Array.isArray(root?.chart_data) ? root.chart_data : [];

    return this.normalizeTransactionHistoryPoints(
      chartData.map((item) => {
        const row = this.asRecord(item);

        return {
          date: row?.date,
          txCount: row?.tx_count,
        };
      }),
    );
  }

  private normalizeRecentTransactions(payload: unknown): NeoXRecentTransaction[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const transactions: NeoXRecentTransaction[] = [];
    for (const item of payload) {
      const row = this.asRecord(item);
      const hash = this.parseString(row?.hash);
      const timestamp = this.parseString(row?.timestamp);
      if (!hash || !timestamp) {
        continue;
      }

      const fee = this.asRecord(row?.fee);
      const txTypes = Array.isArray(row?.tx_types)
        ? row.tx_types.filter((value): value is string => typeof value === 'string')
        : [];
      transactions.push({
        hash: normalizeHash(hash),
        timestamp,
        status: this.parseString(row?.status) ?? 'unknown',
        method: this.parseString(row?.method),
        from: this.parseAddressInfo(row?.from),
        to: this.parseAddressInfo(row?.to),
        feeWei: this.parseString(fee?.value),
        gasUsed: this.parseString(row?.gas_used),
        valueWei: this.parseString(row?.value),
        txTypes,
      });
    }

    return transactions;
  }

  private normalizeTokens(payload: unknown): NeoXToken[] {
    const root = this.asRecord(payload);
    const items = Array.isArray(root?.items) ? root.items : [];
    const tokens: NeoXToken[] = [];

    for (const item of items) {
      const row = this.asRecord(item);
      const address = this.parseString(row?.address);
      const symbol = this.parseString(row?.symbol);
      const name = this.parseString(row?.name);
      if (!address || !symbol || !name) {
        continue;
      }
      if (this.isLiquidityPoolToken(symbol, name)) {
        continue;
      }

      tokens.push({
        address: normalizeHash(address),
        symbol,
        name,
        holders: this.parseInteger(row?.holders),
        totalSupply: this.parseString(row?.total_supply),
        decimals: this.parseInteger(row?.decimals),
        type: this.parseString(row?.type),
      });
    }

    return tokens;
  }

  private isLiquidityPoolToken(symbol: string, name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    if (normalizedName === 'lp token') {
      return true;
    }

    const normalizedSymbol = symbol.trim().toLowerCase();
    if (normalizedSymbol.startsWith('lp-')) {
      return true;
    }

    return false;
  }

  private parseAddressInfo(value: unknown): NeoXAddressInfo | null {
    const address = this.asRecord(value);
    const hash = this.parseString(address?.hash);
    if (!hash) {
      return null;
    }

    return {
      hash: normalizeHash(hash),
      name: this.parseString(address?.name),
      isContract: this.parseBoolean(address?.is_contract),
      isVerified: this.parseBoolean(address?.is_verified),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private parseString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed;
  }

  private parseBoolean(value: unknown): boolean {
    return value === true;
  }

  private parseInteger(value: unknown): number | null {
    const parsed = this.parseNumber(value);
    if (parsed === null || !Number.isFinite(parsed)) {
      return null;
    }

    return Math.trunc(parsed);
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return value;
      }

      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }
}
