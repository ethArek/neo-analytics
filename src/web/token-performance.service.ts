import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DashboardTokenPerformance,
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformanceWindow,
  FlamingoPriceRow,
} from './token-performance.service.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TOP_TOKEN_COUNT = 1;

@Injectable()
export class TokenPerformanceService {
  private readonly logger = new Logger(TokenPerformanceService.name);

  private readonly requestTimeoutMs = 8000;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async getDashboardTokenPerformance(): Promise<DashboardTokenPerformance> {
    const latestUrl = this.getLatestPriceUrl();
    if (!latestUrl) {
      return this.emptyDashboardTokenPerformance();
    }

    const last24hUrl = this.buildHistoricalPriceUrl(latestUrl, Date.now() - DAY_IN_MS);
    const last7dUrl = this.buildHistoricalPriceUrl(latestUrl, Date.now() - 7 * DAY_IN_MS);
    const last30dUrl = this.buildHistoricalPriceUrl(latestUrl, Date.now() - 30 * DAY_IN_MS);
    if (!last24hUrl || !last7dUrl || !last30dUrl) {
      return this.emptyDashboardTokenPerformance();
    }

    try {
      const [latestRows, last24hRows, last7dRows, last30dRows] = await Promise.all([
        this.fetchPriceRows(latestUrl),
        this.fetchPriceRows(last24hUrl),
        this.fetchPriceRows(last7dUrl),
        this.fetchPriceRows(last30dUrl),
      ]);

      return {
        last24h: this.buildWindow('Last 24h', latestRows, last24hRows),
        last7d: this.buildWindow('Last 7 days', latestRows, last7dRows),
        last30d: this.buildWindow('Last 30 days', latestRows, last30dRows),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load dashboard token performance (${reason}). Continuing without token rankings.`,
      );

      return this.emptyDashboardTokenPerformance();
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

  private getLatestPriceUrl(): string | null {
    const configured = this.configService.get<string>('app.flamingoPriceApiUrl')?.trim();
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

  private formatEntry(
    entry: FlamingoPriceRow & {
      changePercent: number;
    },
  ): DashboardTokenPerformanceEntry {
    const tone =
      entry.changePercent > 0 ? 'positive' : entry.changePercent < 0 ? 'negative' : 'neutral';

    return {
      symbol: entry.symbol,
      detail: this.formatDetail(entry),
      changeLabel: this.formatPercent(entry.changePercent),
      tone,
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
