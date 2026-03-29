import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeHash } from '../common/hash.utils';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { formatUnits } from '../stats/stats.utils';
import { isStablecoinSymbol, normalizeSymbol } from './defi-liquidity.utils';
import { TokenPerformanceService } from './token-performance.service';
import type { FlamingoPriceRow } from './token-performance.service.types';
import type {
  CacheEntry,
  TrackedLiquidityAsset,
  TrackedLiquiditySnapshot,
} from './defi-liquidity.service.types';

const TOP_ASSET_COUNT = 6;
const TRACKED_LIQUIDITY_CACHE_TTL_MS = 60 * 1000;
const ALWAYS_INCLUDED_TRACKED_LIQUIDITY_SYMBOLS = new Set(['USDC']);

type LiquidityPriceMatch = {
  usdPrice: number;
  symbol: string;
};

type FlamingoPoolDataRow = {
  hash: string;
  balances: Record<string, string>;
  totalUsdValue: number;
};

@Injectable()
export class DefiLiquidityService {
  private readonly logger = new Logger(DefiLiquidityService.name);
  private readonly requestTimeoutMs = 8000;
  private snapshotCache: CacheEntry<TrackedLiquiditySnapshot | null> | null = null;
  private snapshotPromise: Promise<TrackedLiquiditySnapshot | null> | null = null;

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(TokenPerformanceService)
    private readonly tokenPerformanceService: TokenPerformanceService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async getTrackedLiquiditySnapshot(): Promise<TrackedLiquiditySnapshot | null> {
    const cached = this.getCachedValue(this.snapshotCache);
    if (cached !== undefined) {
      return cached;
    }

    if (this.snapshotPromise) {
      return this.snapshotPromise;
    }

    const loader = this.loadTrackedLiquiditySnapshot();
    this.snapshotPromise = loader;

    try {
      const result = await loader;
      this.snapshotCache = this.createCacheEntry(result, TRACKED_LIQUIDITY_CACHE_TTL_MS);

      return result;
    } finally {
      this.snapshotPromise = null;
    }
  }

  private async loadTrackedLiquiditySnapshot(): Promise<TrackedLiquiditySnapshot | null> {
    const [latestPriceRows, poolRows, totalTvlUsd] = await Promise.all([
      this.tokenPerformanceService.getLatestPriceRows(),
      this.fetchPoolRows(),
      this.fetchTotalTvlUsd(),
    ]);
    if (poolRows.length === 0 && totalTvlUsd === null) {
      return null;
    }

    const priceByHash = new Map<string, LiquidityPriceMatch>();
    for (const row of latestPriceRows) {
      this.indexPriceRow(row, priceByHash);
    }

    const assetHashes = new Set<string>();
    for (const pool of poolRows) {
      for (const assetHash of Object.keys(pool.balances)) {
        assetHashes.add(assetHash);
      }
    }

    const decimalsByAsset = await this.resolvePoolAssetDecimals([...assetHashes]);
    const aggregated = new Map<string, TrackedLiquidityAsset>();
    let stablecoinLiquidityUsd = 0;

    for (const pool of poolRows) {
      for (const [assetHash, rawBalance] of Object.entries(pool.balances)) {
        const pricedAsset = priceByHash.get(assetHash);
        if (!pricedAsset || !Number.isFinite(pricedAsset.usdPrice) || pricedAsset.usdPrice <= 0) {
          continue;
        }

        const decimals = decimalsByAsset.get(assetHash);
        if (decimals === null || decimals === undefined || decimals < 0) {
          continue;
        }

        const balance = this.toTokenAmount(rawBalance, decimals);
        if (!Number.isFinite(balance) || balance <= 0) {
          continue;
        }

        const usdValue = balance * pricedAsset.usdPrice;
        const stablecoin = isStablecoinSymbol(pricedAsset.symbol);
        if (stablecoin) {
          stablecoinLiquidityUsd += usdValue;
        }

        const existing = aggregated.get(assetHash);
        if (existing) {
          existing.balance += balance;
          existing.usdValue += usdValue;
          existing.stablecoin = existing.stablecoin || stablecoin;
          continue;
        }

        aggregated.set(assetHash, {
          asset: assetHash,
          symbol: pricedAsset.symbol,
          balance,
          usdValue,
          stablecoin,
        });
      }
    }

    const derivedTvlUsd = poolRows.reduce((total, pool) => total + pool.totalUsdValue, 0);
    const tvlUsd = totalTvlUsd ?? derivedTvlUsd;
    if (!Number.isFinite(tvlUsd) || tvlUsd <= 0) {
      return null;
    }

    const topAssets = this.selectTopAssets([...aggregated.values()]);

    return {
      trackedTvlUsd: tvlUsd,
      stablecoinLiquidityUsd,
      poolCount: poolRows.length,
      pricedAssets: aggregated.size,
      topAssets,
    };
  }

  private indexPriceRow(row: FlamingoPriceRow, priceByHash: Map<string, LiquidityPriceMatch>) {
    const hash = normalizeHash(row.hash);
    const symbol = normalizeSymbol(row.symbol || row.unwrappedSymbol);
    if (!Number.isFinite(row.usdPrice) || row.usdPrice <= 0 || !hash || !symbol) {
      return;
    }

    priceByHash.set(hash, {
      usdPrice: row.usdPrice,
      symbol,
    });
  }

  private async resolvePoolAssetDecimals(
    assetHashes: string[],
  ): Promise<Map<string, number | null>> {
    const decimalsByAsset = new Map<string, number | null>();
    if (!this.neoClient.resolveAssetDecimals) {
      return decimalsByAsset;
    }

    await Promise.all(
      assetHashes.map(async (assetHash) => {
        try {
          const decimals = await this.neoClient.resolveAssetDecimals?.(assetHash);
          decimalsByAsset.set(assetHash, decimals ?? null);
        } catch (error) {
          this.logger.warn(`Failed to resolve asset decimals for "${assetHash}".`, error);
          decimalsByAsset.set(assetHash, null);
        }
      }),
    );

    return decimalsByAsset;
  }

  private async fetchPoolRows(): Promise<FlamingoPoolDataRow[]> {
    const url = this.getPoolDataUrl();
    if (!url) {
      return [];
    }

    try {
      const payload = await this.fetchJson(url);

      return this.normalizePoolRows(payload);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load Flamingo pool data (${reason}). Continuing without pool-level liquidity breakdown.`,
      );

      return [];
    }
  }

  private async fetchTotalTvlUsd(): Promise<number | null> {
    const url = this.getTvlUrl();
    if (!url) {
      return null;
    }

    try {
      const payload = await this.fetchJson(url);

      return this.parseTvlUsd(payload);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to load Flamingo TVL (${reason}). Falling back to summed pool TVL.`);

      return null;
    }
  }

  private getPoolDataUrl(): string | null {
    const configured = this.configService.get<string>('app.flamingoPoolDataApiUrl')?.trim();
    if (!configured) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  }

  private getTvlUrl(): string | null {
    const configured = this.configService.get<string>('app.flamingoTvlApiUrl')?.trim();
    if (!configured) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  }

  private async fetchJson(url: string): Promise<unknown> {
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

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizePoolRows(payload: unknown): FlamingoPoolDataRow[] {
    const root = this.asRecord(payload);
    const data = this.asRecord(root?.data);
    const poolData = this.asRecord(data?.pool_data) ?? this.asRecord(root?.pool_data);
    if (!poolData) {
      return [];
    }

    const rows: FlamingoPoolDataRow[] = [];
    for (const [fallbackHash, rawPool] of Object.entries(poolData)) {
      const pool = this.asRecord(rawPool);
      const balances = this.asRecord(pool?.balances);
      if (!balances) {
        continue;
      }

      const normalizedBalances: Record<string, string> = {};
      for (const [assetHash, rawBalance] of Object.entries(balances)) {
        if (typeof rawBalance !== 'string' && typeof rawBalance !== 'number') {
          continue;
        }

        normalizedBalances[normalizeHash(assetHash)] = String(rawBalance);
      }

      rows.push({
        hash: normalizeHash(typeof pool?.hash === 'string' ? pool.hash : fallbackHash),
        balances: normalizedBalances,
        totalUsdValue:
          this.parseNumber(pool?.total_usd_value) ??
          this.parseNumber(pool?.totalUsdValue) ??
          this.parseNumber(pool?.tvlUSD) ??
          0,
      });
    }

    return rows.filter((row) => Object.keys(row.balances).length > 0);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
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

  private parseTvlUsd(payload: unknown): number | null {
    const directValue = this.parseNumber(payload);
    if (directValue !== null) {
      return directValue;
    }

    const root = this.asRecord(payload);
    const tvlData = this.asRecord(root?.tvl_data) ?? this.asRecord(root?.data);

    return (
      this.parseNumber(root?.pool_usd) ??
      this.parseNumber(tvlData?.pool_usd) ??
      this.parseNumber(tvlData?.tvl_usd)
    );
  }

  private toTokenAmount(rawBalance: string, decimals: number): number {
    try {
      const normalized = rawBalance.trim();
      if (!normalized) {
        return 0;
      }

      const amount = formatUnits(BigInt(normalized), decimals);
      const parsed = Number(amount);
      if (!Number.isFinite(parsed)) {
        return 0;
      }

      return parsed;
    } catch (_error) {
      return 0;
    }
  }

  private selectTopAssets(assets: TrackedLiquidityAsset[]): TrackedLiquidityAsset[] {
    const sortedAssets = [...assets].sort((left, right) => right.usdValue - left.usdValue);
    const selectedAssets = sortedAssets.slice(0, TOP_ASSET_COUNT);
    const selectedAssetIds = new Set(selectedAssets.map((asset) => asset.asset));

    for (const asset of sortedAssets) {
      if (selectedAssetIds.has(asset.asset)) {
        continue;
      }

      if (!ALWAYS_INCLUDED_TRACKED_LIQUIDITY_SYMBOLS.has(asset.symbol)) {
        continue;
      }

      selectedAssets.push(asset);
      selectedAssetIds.add(asset.asset);
    }

    return selectedAssets.sort((left, right) => right.usdValue - left.usdValue);
  }

  private createCacheEntry<T>(value: T, ttlMs: number): CacheEntry<T> {
    return {
      value,
      expiresAt: Date.now() + ttlMs,
    };
  }

  private getCachedValue<T>(entry: CacheEntry<T> | null): T | undefined {
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      return undefined;
    }

    return entry.value;
  }
}
