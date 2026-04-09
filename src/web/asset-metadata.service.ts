import { Inject, Injectable, Logger } from '@nestjs/common';
import { TtlMapCache } from '../common/cache.utils';
import { normalizeAsset } from '../common/normalize.utils';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';

const ASSET_METADATA_CACHE_TTL_MS = 10 * 60 * 1000;

export type AssetMetadata = {
  label: string;
  decimals: number | null;
};

@Injectable()
export class AssetMetadataService {
  private readonly logger = new Logger(AssetMetadataService.name);
  private readonly metadataCache = new TtlMapCache<AssetMetadata>();

  constructor(@Inject(NEO_CLIENT) private readonly neoClient: NeoClient) {}

  async getAssetMetadata(asset: string): Promise<AssetMetadata> {
    const normalizedAsset = normalizeAsset(asset) ?? asset.trim();
    if (!normalizedAsset) {
      return {
        label: '',
        decimals: null,
      };
    }

    this.metadataCache.prune();

    const cached = this.metadataCache.get(normalizedAsset);
    if (cached !== null) {
      return cached;
    }

    const inFlight = this.metadataCache.getPromise(normalizedAsset);
    if (inFlight) {
      return inFlight;
    }

    const loader = this.loadAssetMetadata(normalizedAsset);
    this.metadataCache.setPromise(normalizedAsset, loader);

    try {
      const metadata = await loader;
      this.metadataCache.set(normalizedAsset, metadata, ASSET_METADATA_CACHE_TTL_MS);

      return metadata;
    } finally {
      this.metadataCache.deletePromise(normalizedAsset);
    }
  }

  private async loadAssetMetadata(asset: string): Promise<AssetMetadata> {
    const [label, decimals] = await Promise.all([
      this.resolveAssetLabel(asset),
      this.resolveAssetDecimals(asset),
    ]);

    return {
      label,
      decimals,
    };
  }

  private async resolveAssetLabel(asset: string): Promise<string> {
    if (!this.neoClient.resolveAssetLabel) {
      return asset;
    }

    try {
      const resolved = await this.neoClient.resolveAssetLabel(asset);
      if (resolved) {
        return resolved;
      }

      this.logger.debug(
        `Asset label resolution returned no value for asset "${asset}", falling back to asset hash.`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to resolve asset label for asset "${asset}", falling back to asset hash.`,
        error instanceof Error ? error.stack : undefined,
      );

      return asset;
    }

    return asset;
  }

  private async resolveAssetDecimals(asset: string): Promise<number | null> {
    if (!this.neoClient.resolveAssetDecimals) {
      return null;
    }

    try {
      return await this.neoClient.resolveAssetDecimals(asset);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve asset decimals for "${asset}", falling back to defaults.`,
        error instanceof Error ? error.stack : undefined,
      );

      return null;
    }
  }
}
