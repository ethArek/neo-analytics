import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CacheEntry,
  ChangeTone,
  CoinPaprikaTicker,
  DashboardTokenPerformance,
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformanceFilters,
  MarketPriceEntry,
  DashboardTokenPerformanceWindow,
  FlamingoDexVolumeRow,
  FlamingoPriceRow,
  MarketPrices,
} from './token-performance.service.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const TOP_TOKEN_COUNT = 1;
const NEO_COIN_PAPRIKA_ID = 'neo-neo';
const GAS_COIN_PAPRIKA_ID = 'gas-gas';
const MARKET_PRICES_CACHE_TTL_MS = 60 * 1000;
const PRICE_ROWS_CACHE_TTL_MS = 60 * 1000;
const ROLLING_DEX_VOLUME_CACHE_TTL_MS = 60 * 1000;

@Injectable()
export class TokenPerformanceService {
  private readonly logger = new Logger(TokenPerformanceService.name);
  private readonly requestTimeoutMs = 8000;
  private marketPricesCache: CacheEntry<MarketPrices> | null = null;
  private marketPricesPromise: Promise<MarketPrices> | null = null;
  private rollingDexVolumeCache: CacheEntry<FlamingoDexVolumeRow[]> | null = null;
  private rollingDexVolumePromise: Promise<FlamingoDexVolumeRow[]> | null = null;
  private readonly priceRowsCache = new Map<string, CacheEntry<FlamingoPriceRow[]>>();
  private readonly priceRowsPromises = new Map<string, Promise<FlamingoPriceRow[]>>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async getMarketPrices(): Promise<MarketPrices> {
    const cached = this.getCachedValue(this.marketPricesCache);
    if (cached) {
      return cached;
    }

    if (this.marketPricesPromise) {
      return this.marketPricesPromise;
    }

    const loader = this.loadMarketPrices();
    this.marketPricesPromise = loader;

    try {
      const result = await loader;
      this.marketPricesCache = this.createCacheEntry(result, MARKET_PRICES_CACHE_TTL_MS);

      return result;
    } finally {
      this.marketPricesPromise = null;
    }
  }

  async getLatestPriceRows(): Promise<FlamingoPriceRow[]> {
    const latestUrl = this.getLatestPriceUrl();
    if (!latestUrl) {
      return [];
    }

    try {
      return await this.getCachedPriceRows(latestUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load latest Flamingo prices (${reason}). Continuing without liquidity pricing.`,
      );

      return [];
    }
  }

  async getRollingDexVolumeRows(): Promise<FlamingoDexVolumeRow[]> {
    const analyticsUrl = this.getRollingDexVolumeUrl();
    if (!analyticsUrl) {
      return [];
    }

    const cached = this.getCachedValue(this.rollingDexVolumeCache);
    if (cached) {
      return cached;
    }

    if (this.rollingDexVolumePromise) {
      return this.rollingDexVolumePromise;
    }

    const loader = this.fetchRollingDexVolumeRows(analyticsUrl);
    this.rollingDexVolumePromise = loader;

    try {
      const result = await loader;
      this.rollingDexVolumeCache = this.createCacheEntry(result, ROLLING_DEX_VOLUME_CACHE_TTL_MS);

      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load Flamingo rolling dex volume (${reason}). Continuing without analytics-backed recent volume.`,
      );

      return [];
    } finally {
      this.rollingDexVolumePromise = null;
    }
  }

  async getDashboardTokenPerformance(
    filters?: DashboardTokenPerformanceFilters,
  ): Promise<DashboardTokenPerformance> {
    const latestUrl = this.getLatestPriceUrl();
    if (!latestUrl) {
      return this.emptyDashboardTokenPerformance();
    }

    const anchorTimestamp = this.normalizeHistoricalTimestamp(Date.now());
    const last24hUrl = this.buildHistoricalPriceUrl(latestUrl, anchorTimestamp - DAY_IN_MS);
    const last7dUrl = this.buildHistoricalPriceUrl(latestUrl, anchorTimestamp - 7 * DAY_IN_MS);
    const last30dUrl = this.buildHistoricalPriceUrl(latestUrl, anchorTimestamp - 30 * DAY_IN_MS);
    if (!last24hUrl || !last7dUrl || !last30dUrl) {
      return this.emptyDashboardTokenPerformance();
    }

    try {
      const [latestRows, last24hRows, last7dRows, last30dRows] = await Promise.all([
        this.getLatestPriceRows(),
        this.getCachedPriceRows(last24hUrl),
        this.getCachedPriceRows(last7dUrl),
        this.getCachedPriceRows(last30dUrl),
      ]);

      return {
        last24h: this.buildWindow('Last 24h', latestRows, last24hRows, filters?.last24h),
        last7d: this.buildWindow('Last 7 days', latestRows, last7dRows, filters?.last7d),
        last30d: this.buildWindow('Last 30 days', latestRows, last30dRows, filters?.last30d),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load dashboard token performance (${reason}). Continuing without token rankings.`,
      );

      return this.emptyDashboardTokenPerformance();
    }
  }

  private async loadMarketPrices(): Promise<MarketPrices> {
    const apiUrl = this.getCoinPaprikaApiUrl();
    if (!apiUrl) {
      return this.emptyMarketPrices();
    }

    try {
      const [neoPrice, gasPrice] = await Promise.all([
        this.fetchCoinPaprikaMarketEntry(apiUrl, NEO_COIN_PAPRIKA_ID),
        this.fetchCoinPaprikaMarketEntry(apiUrl, GAS_COIN_PAPRIKA_ID),
      ]);

      return {
        neo: neoPrice,
        gas: gasPrice,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load latest market prices (${reason}). Continuing without market prices.`,
      );

      return this.emptyMarketPrices();
    }
  }

  private emptyDashboardTokenPerformance(): DashboardTokenPerformance {
    return {
      last24h: {
        label: 'Last 24h',
        gainers: [],
        losers: [],
      },
      last7d: {
        label: 'Last 7 days',
        gainers: [],
        losers: [],
      },
      last30d: {
        label: 'Last 30 days',
        gainers: [],
        losers: [],
      },
    };
  }

  private emptyMarketPrices(): MarketPrices {
    return {
      neo: this.emptyMarketPriceEntry(),
      gas: this.emptyMarketPriceEntry(),
    };
  }

  private emptyMarketPriceEntry(): MarketPriceEntry {
    return {
      price: null,
      change24h: null,
      tone: 'neutral',
    };
  }

  private getCoinPaprikaApiUrl(): string | null {
    const configured = this.configService.get<string>('app.coinPaprikaApiUrl')?.trim();
    if (!configured) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  }

  private getLatestPriceUrl(): string | null {
    const configured = this.configService.get<string>('app.flamingoPriceApiUrl')?.trim();
    if (!configured) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  }

  private getRollingDexVolumeUrl(): string | null {
    const configured = this.configService.get<string>('app.flamingoAnalyticsApiUrl')?.trim();
    if (!configured) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  }

  private buildHistoricalPriceUrl(latestUrl: string, timestamp: number): string | null {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    if (latestUrl.endsWith('/latest')) {
      return `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${Math.floor(timestamp)}`;
    }

    return `${latestUrl}/from-timestamp/${Math.floor(timestamp)}`;
  }

  private normalizeHistoricalTimestamp(timestamp: number): number {
    return Math.floor(timestamp / MINUTE_IN_MS) * MINUTE_IN_MS;
  }

  private async getCachedPriceRows(url: string): Promise<FlamingoPriceRow[]> {
    this.pruneExpiredPriceRowsCache();

    const cached = this.priceRowsCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.priceRowsPromises.get(url);
    if (inFlight) {
      return inFlight;
    }

    const loader = this.fetchPriceRows(url);
    this.priceRowsPromises.set(url, loader);

    try {
      const result = await loader;
      this.priceRowsCache.set(url, this.createCacheEntry(result, PRICE_ROWS_CACHE_TTL_MS));

      return result;
    } finally {
      this.priceRowsPromises.delete(url);
    }
  }

  private async fetchPriceRows(url: string): Promise<FlamingoPriceRow[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();

      return this.normalizePriceRows(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchRollingDexVolumeRows(url: string): Promise<FlamingoDexVolumeRow[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();

      return this.normalizeRollingDexVolumeRows(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

  private pruneExpiredPriceRowsCache() {
    const now = Date.now();

    for (const [url, entry] of this.priceRowsCache.entries()) {
      if (entry.expiresAt <= now) {
        this.priceRowsCache.delete(url);
      }
    }
  }

  private normalizePriceRows(payload: unknown): FlamingoPriceRow[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const rows: FlamingoPriceRow[] = [];
    for (const item of payload) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const symbol = typeof item.symbol === 'string' ? item.symbol.trim() : '';
      const unwrappedSymbol =
        typeof item.unwrappedSymbol === 'string' ? item.unwrappedSymbol.trim() : '';
      const hash = typeof item.hash === 'string' ? item.hash.trim().toLowerCase() : '';
      const usdPrice = this.parsePrice(item.usd_price);
      if ((!symbol && !unwrappedSymbol) || !hash || usdPrice === null || usdPrice <= 0) {
        continue;
      }

      rows.push({
        symbol: symbol || unwrappedSymbol,
        unwrappedSymbol: unwrappedSymbol || symbol || '',
        hash,
        usdPrice,
      });
    }

    return rows;
  }

  private normalizeRollingDexVolumeRows(payload: unknown): FlamingoDexVolumeRow[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const rowsByDate = new Map<string, FlamingoDexVolumeRow>();
    for (const item of payload) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const date = this.normalizeAnalyticsDate(item.date);
      if (!date) {
        continue;
      }

      const totalData =
        item.total_data && typeof item.total_data === 'object' ? item.total_data : undefined;
      const swapVolume = this.parsePrice(totalData?.swap_volume) ?? 0;
      const totalOrderVolume = this.parsePrice(totalData?.total_order_volume) ?? swapVolume;
      rowsByDate.set(date, {
        date,
        swapVolume: Math.max(0, swapVolume),
        totalOrderVolume: Math.max(0, totalOrderVolume),
      });
    }

    return [...rowsByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  private normalizeAnalyticsDate(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      return null;
    }

    return match[1];
  }

  private async fetchCoinPaprikaMarketEntry(
    apiUrl: string,
    coinId: string,
  ): Promise<MarketPriceEntry> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await fetch(`${apiUrl}/tickers/${coinId}?quotes=USD`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      const { price, percentChange24h } = this.parseCoinPaprikaTicker(payload);
      if (price === null || price <= 0) {
        return this.emptyMarketPriceEntry();
      }

      return {
        price: this.formatUsd(price),
        change24h: percentChange24h === null ? null : this.formatPercent(percentChange24h),
        tone: this.resolveTone(percentChange24h),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseCoinPaprikaTicker(payload: unknown): {
    price: number | null;
    percentChange24h: number | null;
  } {
    if (!payload || typeof payload !== 'object') {
      return {
        price: null,
        percentChange24h: null,
      };
    }

    const ticker = payload as CoinPaprikaTicker;

    return {
      price: this.parsePrice(ticker.quotes?.USD?.price),
      percentChange24h: this.parsePrice(ticker.quotes?.USD?.percent_change_24h),
    };
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return value;
      }

      return null;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private buildWindow(
    label: string,
    latestRows: FlamingoPriceRow[],
    previousRows: FlamingoPriceRow[],
    activeAssets?: ReadonlySet<string>,
  ): DashboardTokenPerformanceWindow {
    const previousByHash = new Map<string, FlamingoPriceRow>();
    for (const row of previousRows) {
      previousByHash.set(row.hash, row);
    }

    const entries: Array<
      FlamingoPriceRow & {
        changePercent: number;
      }
    > = [];

    for (const latest of latestRows) {
      if (activeAssets && !this.hasTrackedSwapActivity(latest, activeAssets)) {
        continue;
      }

      const previous = previousByHash.get(latest.hash);
      if (!previous || previous.usdPrice <= 0) {
        continue;
      }

      const changePercent = ((latest.usdPrice - previous.usdPrice) / previous.usdPrice) * 100;
      if (!Number.isFinite(changePercent)) {
        continue;
      }

      entries.push({
        ...latest,
        changePercent,
      });
    }

    const gainers = [...entries]
      .sort((left, right) => {
        if (right.changePercent !== left.changePercent) {
          return right.changePercent - left.changePercent;
        }

        return left.symbol.localeCompare(right.symbol);
      })
      .slice(0, TOP_TOKEN_COUNT)
      .map((entry) => this.formatEntry(entry));
    const losers = [...entries]
      .sort((left, right) => {
        if (left.changePercent !== right.changePercent) {
          return left.changePercent - right.changePercent;
        }

        return left.symbol.localeCompare(right.symbol);
      })
      .slice(0, TOP_TOKEN_COUNT)
      .map((entry) => this.formatEntry(entry));

    return {
      label,
      gainers,
      losers,
    };
  }

  private hasTrackedSwapActivity(
    row: FlamingoPriceRow,
    activeAssets: ReadonlySet<string>,
  ): boolean {
    if (activeAssets.has(row.hash.toLowerCase())) {
      return true;
    }

    if (activeAssets.has(row.symbol.toUpperCase())) {
      return true;
    }

    return activeAssets.has(row.unwrappedSymbol.toUpperCase());
  }

  private formatEntry(
    entry: FlamingoPriceRow & {
      changePercent: number;
    },
  ): DashboardTokenPerformanceEntry {
    return {
      symbol: entry.symbol,
      detail: this.formatDetail(entry),
      changeLabel: this.formatPercent(entry.changePercent),
      tone: this.resolveTone(entry.changePercent),
    };
  }

  private formatDetail(entry: FlamingoPriceRow): string {
    return this.formatUsd(entry.usdPrice);
  }

  private formatUsd(value: number): string {
    const fractionDigits = this.resolveUsdFractionDigits(value);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }

  private formatPercent(value: number): string {
    const sign = value > 0 ? '+' : '';

    return `${sign}${value.toFixed(2)}%`;
  }

  private resolveTone(value: number | null): ChangeTone {
    if (value === null || !Number.isFinite(value)) {
      return 'neutral';
    }

    if (value > 0) {
      return 'positive';
    }

    if (value < 0) {
      return 'negative';
    }

    return 'neutral';
  }

  private resolveUsdFractionDigits(value: number): number {
    if (value >= 1) {
      return 2;
    }

    if (value >= 0.1) {
      return 4;
    }

    if (value >= 0.01) {
      return 5;
    }

    if (value >= 0.001) {
      return 6;
    }

    return 8;
  }

  private createCacheEntry<T>(value: T, ttlMs: number): CacheEntry<T> {
    return {
      value,
      expiresAt: Date.now() + ttlMs,
    };
  }

  private getCachedValue<T>(entry: CacheEntry<T> | null): T | null {
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      return null;
    }

    return entry.value;
  }
}
