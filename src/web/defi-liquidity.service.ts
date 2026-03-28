import { wallet } from '@cityofzion/neon-js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeHash } from '../common/hash.utils';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { defaultSwapContracts } from '../classifier/classifier';
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

@Injectable()
export class DefiLiquidityService {
  private readonly logger = new Logger(DefiLiquidityService.name);
  private snapshotCache: CacheEntry<TrackedLiquiditySnapshot | null> | null = null;
  private snapshotPromise: Promise<TrackedLiquiditySnapshot | null> | null = null;

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(TokenPerformanceService)
    private readonly tokenPerformanceService: TokenPerformanceService,
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
    if (!this.neoClient.getAddressBalances) {
      return null;
    }

    const getAddressBalances = this.neoClient.getAddressBalances.bind(this.neoClient);
    const latestPriceRows = await this.tokenPerformanceService.getLatestPriceRows();
    if (latestPriceRows.length === 0) {
      return null;
    }

    const priceByHash = new Map<string, LiquidityPriceMatch>();
    const priceBySymbol = new Map<string, LiquidityPriceMatch>();
    for (const row of latestPriceRows) {
      this.indexPriceRow(row, priceByHash, priceBySymbol);
    }

    const aggregated = new Map<string, TrackedLiquidityAsset>();
    let trackedTvlUsd = 0;
    let stablecoinLiquidityUsd = 0;
    const contracts = defaultSwapContracts
      .map((contract) => ({
        contract,
        address: this.toAddress(contract),
      }))
      .filter((entry): entry is { contract: string; address: string } => Boolean(entry.address));
    const balanceSnapshots = await Promise.all(
      contracts.map(async ({ contract, address }) => {
        try {
          return await getAddressBalances(address);
        } catch (error) {
          this.logger.warn(
            `Failed to load balances for tracked swap contract "${contract}".`,
            error,
          );

          return [];
        }
      }),
    );

    for (const balances of balanceSnapshots) {
      for (const balance of balances) {
        if (!Number.isFinite(balance.balance) || balance.balance <= 0) {
          continue;
        }

        const assetHash = normalizeHash(balance.asset);
        const symbol = normalizeSymbol(balance.symbol);
        const pricedAsset = priceByHash.get(assetHash) ?? priceBySymbol.get(symbol);
        if (!pricedAsset || !Number.isFinite(pricedAsset.usdPrice) || pricedAsset.usdPrice <= 0) {
          continue;
        }

        const usdValue = balance.balance * pricedAsset.usdPrice;
        trackedTvlUsd += usdValue;

        const stablecoin = isStablecoinSymbol(pricedAsset.symbol);
        if (stablecoin) {
          stablecoinLiquidityUsd += usdValue;
        }

        const existing = aggregated.get(assetHash);
        if (existing) {
          existing.balance += balance.balance;
          existing.usdValue += usdValue;
          existing.stablecoin = existing.stablecoin || stablecoin;
          continue;
        }

        aggregated.set(assetHash, {
          asset: assetHash,
          symbol: pricedAsset.symbol,
          balance: balance.balance,
          usdValue,
          stablecoin,
        });
      }
    }

    const topAssets = this.selectTopAssets([...aggregated.values()]);

    return {
      trackedTvlUsd,
      stablecoinLiquidityUsd,
      trackedContracts: defaultSwapContracts.length,
      pricedAssets: aggregated.size,
      topAssets,
    };
  }

  private indexPriceRow(
    row: FlamingoPriceRow,
    priceByHash: Map<string, LiquidityPriceMatch>,
    priceBySymbol: Map<string, LiquidityPriceMatch>,
  ) {
    const hash = normalizeHash(row.hash);
    const symbol = normalizeSymbol(row.symbol || row.unwrappedSymbol);
    if (!Number.isFinite(row.usdPrice) || row.usdPrice <= 0 || !symbol) {
      return;
    }

    const pricedAsset = {
      usdPrice: row.usdPrice,
      symbol,
    };
    if (hash) {
      priceByHash.set(hash, pricedAsset);
    }

    if (!priceBySymbol.has(symbol)) {
      priceBySymbol.set(symbol, pricedAsset);
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

  private toAddress(contractHash: string): string | null {
    const normalized = normalizeHash(contractHash);
    if (!normalized) {
      return null;
    }

    try {
      return wallet.getAddressFromScriptHash(normalized.slice(2));
    } catch (_error) {
      return null;
    }
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
