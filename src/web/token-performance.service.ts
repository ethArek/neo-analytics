import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtlCache, TtlMapCache } from '../common/cache.utils';
import { buildHistoricalUrl, getConfigUrl } from '../common/config.utils';
import { fetchJsonWithTimeout } from '../common/fetch.utils';
import { normalizeHash, normalizeSymbol } from '../common/normalize.utils';
import type {
  AssetMarketSnapshot,
  ChangeTone,
  CoinPaprikaTicker,
  DashboardTokenPerformance,
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformanceFilters,
  DashboardTokenPerformanceWindow,
  FlamingoDexVolumeRow,
  FlamingoPriceRow,
  MarketPriceEntry,
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
  private readonly marketPricesCache = new TtlCache<MarketPrices>();
  private readonly rollingDexVolumeCache = new TtlCache<FlamingoDexVolumeRow[]>();
  private readonly priceRowsCache = new TtlMapCache<FlamingoPriceRow[]>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async getMarketPrices(): Promise<MarketPrices> {
    const cached = this.marketPricesCache.getValue();
    if (cached !== null) {
      return cached;
    }

    const existingPromise = this.marketPricesCache.getPromise();
    if (existingPromise) {
      return existingPromise;
    }

    const loader = this.loadMarketPrices();
    this.marketPricesCache.setPromise(loader);

    try {
      const result = await loader;
      this.marketPricesCache.set(result, MARKET_PRICES_CACHE_TTL_MS);

      return result;
    } finally {
      this.marketPricesCache.setPromise(null);
    }
  }

  async getLatestPriceRows(): Promise<FlamingoPriceRow[]> {
    const latestUrl = getConfigUrl(this.configService, 'app.flamingoPriceApiUrl');
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
    const analyticsUrl = getConfigUrl(this.configService, 'app.flamingoAnalyticsApiUrl');
    if (!analyticsUrl) {
      return [];
    }

    const cached = this.rollingDexVolumeCache.getValue();
    if (cached !== null) {
      return cached;
    }

    const existingPromise = this.rollingDexVolumeCache.getPromise();
    if (existingPromise) {
      return existingPromise;
    }

    const loader = this.fetchRollingDexVolumeRows(analyticsUrl);
    this.rollingDexVolumeCache.setPromise(loader);

    try {
      const result = await loader;
      this.rollingDexVolumeCache.set(result, ROLLING_DEX_VOLUME_CACHE_TTL_MS);

      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load Flamingo rolling dex volume (${reason}). Continuing without analytics-backed recent volume.`,
      );

      return [];
    } finally {
      this.rollingDexVolumeCache.setPromise(null);
    }
  }

  async getDashboardTokenPerformance(
    filters?: DashboardTokenPerformanceFilters,
  ): Promise<DashboardTokenPerformance> {
    const latestUrl = getConfigUrl(this.configService, 'app.flamingoPriceApiUrl');
    if (!latestUrl) {
      return this.emptyDashboardTokenPerformance();
    }

    const anchorTimestamp = this.normalizeHistoricalTimestamp(Date.now());
    const last24hUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - DAY_IN_MS);
    const last7dUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - 7 * DAY_IN_MS);
    const last30dUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - 30 * DAY_IN_MS);
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

  async getAssetMarketSnapshot(asset: string): Promise<AssetMarketSnapshot | null> {
    const latestUrl = getConfigUrl(this.configService, 'app.flamingoPriceApiUrl');
    if (!latestUrl) {
      return null;
    }

    const assetLookup = this.normalizeAssetLookup(asset);
    if (!assetLookup.hash && !assetLookup.symbol) {
      return null;
    }

    const anchorTimestamp = this.normalizeHistoricalTimestamp(Date.now());
    const last24hUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - DAY_IN_MS);
    const last7dUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - 7 * DAY_IN_MS);
    const last30dUrl = buildHistoricalUrl(latestUrl, anchorTimestamp - 30 * DAY_IN_MS);
    if (!last24hUrl || !last7dUrl || !last30dUrl) {
      return null;
    }

    try {
      const [latestRows, last24hRows, last7dRows, last30dRows] = await Promise.all([
        this.getLatestPriceRows(),
        this.getCachedPriceRows(last24hUrl),
        this.getCachedPriceRows(last7dUrl),
        this.getCachedPriceRows(last30dUrl),
      ]);
      const latest = this.findPriceRowForAsset(assetLookup, latestRows);
      if (!latest) {
        return null;
      }

      return {
        symbol: latest.symbol,
        currentPrice: this.formatUsd(latest.usdPrice),
        change24h: this.formatAssetPriceChange(
          latest,
          this.findPriceRowForAsset(assetLookup, last24hRows),
        ),
        change7d: this.formatAssetPriceChange(
          latest,
          this.findPriceRowForAsset(assetLookup, last7dRows),
        ),
        change30d: this.formatAssetPriceChange(
          latest,
          this.findPriceRowForAsset(assetLookup, last30dRows),
        ),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load asset market snapshot (${reason}). Continuing without asset-specific market context.`,
      );

      return null;
    }
  }

  private async loadMarketPrices(): Promise<MarketPrices> {
    const apiUrl = getConfigUrl(this.configService, 'app.coinPaprikaApiUrl');
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

  private normalizeAssetLookup(asset: string): {
    hash: string | null;
    symbol: string | null;
  } {
    const trimmed = asset.trim();
    if (!trimmed) {
      return {
        hash: null,
        symbol: null,
      };
    }

    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      return {
        hash: normalizeHash(trimmed),
        symbol: null,
      };
    }

    return {
      hash: null,
      symbol: normalizeSymbol(trimmed),
    };
  }

  private emptyMarketPriceEntry(): MarketPriceEntry {
    return {
      price: null,
      change24h: null,
      tone: 'neutral',
    };
  }

  private normalizeHistoricalTimestamp(timestamp: number): number {
    return Math.floor(timestamp / MINUTE_IN_MS) * MINUTE_IN_MS;
  }

  private async getCachedPriceRows(url: string): Promise<FlamingoPriceRow[]> {
    this.priceRowsCache.prune();

    const cached = this.priceRowsCache.get(url);
    if (cached !== null) {
      return cached;
    }

    const inFlight = this.priceRowsCache.getPromise(url);
    if (inFlight) {
      return inFlight;
    }

    const loader = this.fetchPriceRows(url);
    this.priceRowsCache.setPromise(url, loader);

    try {
      const result = await loader;
      this.priceRowsCache.set(url, result, PRICE_ROWS_CACHE_TTL_MS);

      return result;
    } finally {
      this.priceRowsCache.deletePromise(url);
    }
  }

  private async fetchPriceRows(url: string): Promise<FlamingoPriceRow[]> {
    try {
      const payload = await fetchJsonWithTimeout<unknown[]>(url, this.requestTimeoutMs);

      return this.normalizePriceRows(payload);
    } catch (error) {
      throw error;
    }
  }

  private async fetchRollingDexVolumeRows(url: string): Promise<FlamingoDexVolumeRow[]> {
    try {
      const payload = await fetchJsonWithTimeout<unknown[]>(url, this.requestTimeoutMs);

      return this.normalizeRollingDexVolumeRows(payload);
    } catch (error) {
      throw error;
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
    try {
      const payload = await fetchJsonWithTimeout<CoinPaprikaTicker>(
        `${apiUrl}/tickers/${coinId}?quotes=USD`,
        this.requestTimeoutMs,
      );
      const { price, percentChange24h } = this.parseCoinPaprikaTicker(payload);
      if (price === null || price <= 0) {
        return this.emptyMarketPriceEntry();
      }

      return {
        price: this.formatUsd(price),
        change24h: percentChange24h === null ? null : this.formatPercent(percentChange24h),
        tone: this.resolveTone(percentChange24h),
      };
    } catch (error) {
      throw error;
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

  private findPriceRowForAsset(
    assetLookup: {
      hash: string | null;
      symbol: string | null;
    },
    rows: FlamingoPriceRow[],
  ): FlamingoPriceRow | null {
    for (const row of rows) {
      if (assetLookup.hash && row.hash.toLowerCase() === assetLookup.hash) {
        return row;
      }

      if (
        assetLookup.symbol &&
        (normalizeSymbol(row.symbol) === assetLookup.symbol ||
          normalizeSymbol(row.unwrappedSymbol) === assetLookup.symbol)
      ) {
        return row;
      }
    }

    return null;
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

  private formatAssetPriceChange(
    latest: FlamingoPriceRow,
    previous: FlamingoPriceRow | null,
  ): string | null {
    if (!previous || previous.usdPrice <= 0) {
      return null;
    }

    const changePercent = ((latest.usdPrice - previous.usdPrice) / previous.usdPrice) * 100;
    if (!Number.isFinite(changePercent)) {
      return null;
    }

    return this.formatPercent(changePercent);
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
}
