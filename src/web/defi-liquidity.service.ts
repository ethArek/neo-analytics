import { wallet } from '@cityofzion/neon-js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { defaultSwapContracts } from '../classifier/classifier';
import { TokenPerformanceService } from './token-performance.service';
import type { FlamingoPriceRow } from './token-performance.service.types';
import type {
  TrackedLiquidityAsset,
  TrackedLiquiditySnapshot,
} from './defi-liquidity.service.types';

const TOP_ASSET_COUNT = 6;
const TRACKED_LIQUIDITY_CACHE_TTL_MS = 60 * 1000;
const NEO_N3_STABLECOIN_SYMBOLS = new Set(['FUSD', 'USDT', 'USDC']);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const normalizeHash = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('0x')) {
    return normalized;
  }

  return `0x${normalized}`;
};

const normalizeSymbol = (value: string): string => value.trim().toUpperCase();

const isStablecoinSymbol = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }

  return NEO_N3_STABLECOIN_SYMBOLS.has(normalized);
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

    const priceByHash = new Map<string, number>();
    const priceBySymbol = new Map<string, number>();
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
        const usdPrice = priceByHash.get(assetHash) ?? priceBySymbol.get(symbol);
        if (!usdPrice || !Number.isFinite(usdPrice) || usdPrice <= 0) {
          continue;
        }

        const usdValue = balance.balance * usdPrice;
        trackedTvlUsd += usdValue;

        const stablecoin = isStablecoinSymbol(symbol);
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
          symbol,
          balance: balance.balance,
          usdValue,
          stablecoin,
        });
      }
    }

    const topAssets = [...aggregated.values()]
      .sort((left, right) => right.usdValue - left.usdValue)
      .slice(0, TOP_ASSET_COUNT);

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
    priceByHash: Map<string, number>,
    priceBySymbol: Map<string, number>,
  ) {
    const hash = normalizeHash(row.hash);
    if (hash && Number.isFinite(row.usdPrice) && row.usdPrice > 0) {
      priceByHash.set(hash, row.usdPrice);
    }

    const symbol = normalizeSymbol(row.symbol);
    if (symbol && Number.isFinite(row.usdPrice) && row.usdPrice > 0 && !priceBySymbol.has(symbol)) {
      priceBySymbol.set(symbol, row.usdPrice);
    }
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
