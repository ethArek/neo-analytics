import { Controller, Get, Inject, Param, Query, Redirect, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { formatDate } from '../ingestion/date-utils';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { StatsService } from '../stats/stats.service';
import { formatNumber, formatUnits, toNumber } from '../stats/stats.utils';
import { countInclusiveDays, normalizeIsoDate, resolveDefiWindow } from './defi-metrics';
import { renderReactPage } from './react-view';
import { TokenPerformanceService } from './token-performance.service';
import type { StatTotals } from './web.controller.types';

@ApiExcludeController()
@Controller()
export class WebController {
  private readonly dayPageSizeOptions = [25, 50, 100, 200];

  private readonly defaultDayPageSize = 50;

  private readonly maxDayPageSize = 200;

  constructor(
    @Inject(StatsService) private readonly statsService: StatsService,
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(TokenPerformanceService)
    private readonly tokenPerformanceService: TokenPerformanceService,
  ) {}

  @Get('/favicon.ico')
  @Redirect('/favicon.svg', 302)
  favicon() {}

  @Get('/')
  @Redirect('/dashboard', 302)
  root() {}

  @Get('/faq')
  faq(@Res() res: Response) {
    return res.send(
      renderReactPage({
        title: 'Neo Analytics - FAQ',
        page: 'faq',
        data: {
          nav: {
            faq: true,
          },
        },
      }),
    );
  }

  @Get('/special-thanks')
  specialThanks(@Res() res: Response) {
    return res.send(
      renderReactPage({
        title: 'Neo Analytics - Special thanks',
        page: 'special-thanks',
        data: {
          nav: {
            specialThanks: true,
          },
        },
      }),
    );
  }

  @Get('/dashboard')
  async dashboard(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to, 30);
    const labeledStats = stats.map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
    }));
    const totals = stats[stats.length - 1] ?? this.emptyTotals();

    if (!range) {
      return res.send(
        renderReactPage({
          title: 'Neo Analytics',
          page: 'dashboard',
          data: {
            nav: {
              dashboard: true,
            },
            totals: this.formatTotals(totals),
            chartData: this.buildChartData(labeledStats, []),
            rangeLabel: 'No data available',
            rangeFrom: '',
            rangeTo: '',
            topSenders: [],
            topReceivers: [],
            assetBreakdown: [],
          },
        }),
      );
    }

    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);
    const [assetStats, topSenders, topReceivers] = await Promise.all([
      this.statsService.getAssetStatsRange(rangeFrom, rangeTo),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'from', 6),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'to', 6),
    ]);
    const [assetLabelMap, assetDecimalsMap] = await Promise.all([
      this.buildAssetLabelMap(assetStats.map((asset) => asset.asset)),
      this.buildAssetDecimalsMap(assetStats.map((asset) => asset.asset)),
    ]);
    const labeledAssetStats = assetStats.map((asset) => ({
      ...asset,
      assetLabel: this.normalizeAssetLabel(assetLabelMap.get(asset.asset), asset.asset),
    }));
    const assetBreakdown = [...labeledAssetStats]
      .sort((a, b) => b.transferCount - a.transferCount)
      .slice(0, 10)
      .map((asset) => ({
        assetLabel: this.normalizeAssetLabel(asset.assetLabel, asset.asset),
        transferCount: formatNumber(asset.transferCount),
        volumeLabel: this.formatAmount(
          asset.asset,
          asset.volumeRaw,
          this.getAssetDecimals(asset.asset, assetDecimalsMap),
        ),
      }));
    const chartData = this.buildChartData(labeledStats, labeledAssetStats);

    return res.send(
      renderReactPage({
        title: 'Neo Analytics',
        page: 'dashboard',
        data: {
          nav: {
            dashboard: true,
          },
          totals: this.formatTotals(totals),
          chartData,
          rangeLabel: `${rangeFrom} to ${rangeTo}`,
          rangeFrom,
          rangeTo,
          topSenders: topSenders.map((entry) => ({
            address: entry.address,
            shortAddress: this.shortenAddress(entry.address),
            transferCount: formatNumber(entry.transferCount),
          })),
          topReceivers: topReceivers.map((entry) => ({
            address: entry.address,
            shortAddress: this.shortenAddress(entry.address),
            transferCount: formatNumber(entry.transferCount),
          })),
          assetBreakdown,
        },
      }),
    );
  }

  @Get('/defi')
  async defi(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const [{ stats: latestStats }, tokenPerformance] = await Promise.all([
      this.statsService.getRangeOrLatest(undefined, undefined, 30),
      this.tokenPerformanceService.getDashboardTokenPerformance(),
    ]);
    const availableFrom = this.getDefiMetricsAvailableFrom();
    const defaultRange = this.buildDefaultDefiRange(latestStats, availableFrom);
    const window = resolveDefiWindow({
      availableFrom,
      requestedFrom: from,
      requestedTo: to,
      fallbackFrom: defaultRange.from,
      fallbackTo: defaultRange.to,
    });

    let stats: typeof latestStats = [];
    if (
      (window.status === 'ready' || window.status === 'partial') &&
      window.effectiveFrom &&
      window.effectiveTo
    ) {
      stats = await this.statsService.getStatsRange(window.effectiveFrom, window.effectiveTo);
    }

    const hasStats = stats.length > 0;
    const requestedDays = countInclusiveDays(window.requestedFrom, window.requestedTo);
    const coveredDays = countInclusiveDays(window.effectiveFrom, window.effectiveTo);
    const totalSwapUsdValue = stats.reduce(
      (total, stat) => total.add(stat.swapsUsdValue),
      new Prisma.Decimal(0),
    );
    const totalSwaps = stats.reduce((total, stat) => total + stat.swapsCount, 0);
    const averageSwapUsdValue =
      totalSwaps > 0 ? totalSwapUsdValue.div(totalSwaps) : new Prisma.Decimal(0);

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - DeFi metrics',
        page: 'defi',
        data: {
          nav: {
            defi: true,
          },
          tokenPerformance,
          totals: hasStats
            ? {
                estimatedSwapUsdValue: this.formatUsd(totalSwapUsdValue),
                swaps: formatNumber(totalSwaps),
                averageSwapUsdValue: this.formatUsd(averageSwapUsdValue),
                coveredDays: formatNumber(coveredDays),
                requestedDays: formatNumber(requestedDays),
              }
            : null,
          chartData: hasStats ? this.buildDefiChartData(stats) : null,
        },
      }),
    );
  }
  @Get('/days')
  async days(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to, 90);
    const labeledStats = stats.map((stat) => ({
      dateLabel: formatDate(stat.date),
      totalTxCountLabel: formatNumber(stat.totalTxCount),
      swapsCountLabel: formatNumber(stat.swapsCount),
      transfersCountLabel: formatNumber(stat.transfersCount),
      gasClaimsCountLabel: formatNumber(stat.gasClaimsCount),
      othersCountLabel: formatNumber(stat.othersCount),
      realUsageTotalLabel: formatNumber(stat.realUsageTotal),
    }));

    if (!range) {
      return res.send(
        renderReactPage({
          title: 'Neo Analytics - Daily table',
          page: 'days',
          data: {
            nav: {
              dashboard: true,
            },
            stats: labeledStats,
            rangeLabel: 'No data available',
            rangeFrom: '',
            rangeTo: '',
          },
        }),
      );
    }

    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - Daily table',
        page: 'days',
        data: {
          nav: {
            dashboard: true,
          },
          stats: labeledStats,
          rangeLabel: `${rangeFrom} to ${rangeTo}`,
          rangeFrom,
          rangeTo,
        },
      }),
    );
  }

  @Get('/day/:date')
  async day(
    @Res() res: Response,
    @Param('date') date: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const requestedPage = this.parsePositiveInt(page, 1);
    const requestedPageSize = this.resolveDayPageSize(pageSize);
    const { stat, transactions, assetStats, pagination } = await this.statsService.getDayDetails(
      date,
      {
        page: requestedPage,
        pageSize: requestedPageSize,
      },
    );
    const dayAssets = [
      ...assetStats.map((asset) => asset.asset),
      ...transactions.map((transaction) => transaction.asset),
    ];
    const [assetLabelMap, assetDecimalsMap] = await Promise.all([
      this.buildAssetLabelMap(dayAssets),
      this.buildAssetDecimalsMap(dayAssets),
    ]);

    const formattedTransactions = transactions.map((tx) => ({
      txid: tx.txid,
      timestampLabel: new Date(tx.timestamp).toISOString(),
      shortTxid: this.shortenAddress(tx.txid),
      type: tx.type,
      assetLabel: this.getAssetLabel(tx.asset, assetLabelMap),
      amountLabel: this.formatAmount(
        tx.asset,
        tx.amountRaw ?? 0n,
        this.getAssetDecimals(tx.asset, assetDecimalsMap),
      ),
      from: tx.from,
      to: tx.to,
      method: tx.method,
    }));

    return res.send(
      renderReactPage({
        title: `Neo Analytics - ${date}`,
        page: 'day',
        data: {
          nav: {
            dashboard: true,
          },
          date,
          stat: stat ? this.formatStat(stat) : null,
          transactions: formattedTransactions,
          pagination: {
            ...pagination,
            pageSizeOptions: this.dayPageSizeOptions,
          },
          assetStats: assetStats.map((asset) => ({
            assetLabel: this.getAssetLabel(asset.asset, assetLabelMap),
            transferCount: asset.transferCount,
            volumeLabel: this.formatAmount(
              asset.asset,
              asset.volumeRaw,
              this.getAssetDecimals(asset.asset, assetDecimalsMap),
            ),
          })),
        },
      }),
    );
  }

  private getDefiMetricsAvailableFrom(): string | null {
    const configured = this.configService.get<string>('app.defiMetricsAvailableFrom');

    return normalizeIsoDate(configured);
  }

  private buildDefaultDefiRange(
    stats: Awaited<ReturnType<StatsService['getLatestStats']>>,
    availableFrom: string | null,
  ) {
    const filteredStats = availableFrom
      ? stats.filter((stat) => formatDate(stat.date, 'UTC') >= availableFrom)
      : stats;
    const sourceStats = filteredStats.length > 0 ? filteredStats : stats;
    const from = sourceStats[0] ? formatDate(sourceStats[0].date, 'UTC') : availableFrom;
    const to = sourceStats[sourceStats.length - 1]
      ? formatDate(sourceStats[sourceStats.length - 1].date, 'UTC')
      : (from ?? availableFrom);

    return {
      from,
      to,
    };
  }

  private buildDefiChartData(stats: Awaited<ReturnType<StatsService['getLatestStats']>>) {
    return {
      labels: stats.map((stat) => formatDate(stat.date)),
      series: {
        swapUsdValue: stats.map((stat) => Number(stat.swapsUsdValue)),
        swaps: stats.map((stat) => stat.swapsCount),
      },
    };
  }

  private emptyTotals(): StatTotals {
    return {
      totalTxCount: 0,
      swapsCount: 0,
      swapsUsdValue: '0.00000000',
      transfersCount: 0,
      gasClaimsCount: 0,
      othersCount: 0,
      realUsageTotal: 0,
      totalTransfers: 0,
      uniqueSenders: 0,
      uniqueReceivers: 0,
      uniqueAddresses: 0,
      neoVolumeRaw: 0n,
      gasVolumeRaw: 0n,
      blockCount: 0,
    };
  }

  private formatTotals(totals: StatTotals) {
    return {
      swaps: formatNumber(totals.swapsCount),
      transfers: formatNumber(totals.transfersCount),
      gasClaims: formatNumber(totals.gasClaimsCount),
      others: formatNumber(totals.othersCount),
      realUsage: formatNumber(totals.realUsageTotal),
      totalTxs: formatNumber(totals.totalTxCount),
      totalTransfers: formatNumber(totals.totalTransfers),
      activeAddresses: formatNumber(totals.uniqueAddresses),
      neoVolume: this.formatAmount('NEO', totals.neoVolumeRaw),
      gasVolume: this.formatAmount('GAS', totals.gasVolumeRaw),
      blocks: formatNumber(totals.blockCount),
    };
  }

  private formatStat(stat: StatTotals) {
    return {
      totalTxCount: stat.totalTxCount,
      realUsageTotal: stat.realUsageTotal,
      uniqueAddresses: stat.uniqueAddresses,
      neoVolume: this.formatAmount('NEO', stat.neoVolumeRaw),
      gasVolume: this.formatAmount('GAS', stat.gasVolumeRaw),
      othersCount: stat.othersCount,
      blockCount: stat.blockCount,
    };
  }

  private buildChartData(
    stats: Array<
      Awaited<ReturnType<StatsService['getLatestStats']>>[number] & { dateLabel: string }
    >,
    assetStats: Array<
      Awaited<ReturnType<StatsService['getAssetStatsRange']>>[number] & {
        assetLabel?: string;
      }
    >,
  ) {
    const labels = stats.map((stat) => stat.dateLabel);
    const assetsSorted = [...assetStats].sort((a, b) => b.transferCount - a.transferCount);
    const topAssets = assetsSorted.slice(0, 5);
    const remainingAssets = assetsSorted.slice(5);
    const otherTransfers = remainingAssets.reduce((total, asset) => total + asset.transferCount, 0);
    const assetLabels = topAssets.map((asset) =>
      this.normalizeAssetLabel(asset.assetLabel, asset.asset),
    );
    const assetValues = topAssets.map((asset) => asset.transferCount);
    if (otherTransfers > 0) {
      assetLabels.push('Other');
      assetValues.push(otherTransfers);
    }

    return {
      labels,
      series: {
        swaps: stats.map((stat) => stat.swapsCount),
        transfers: stats.map((stat) => stat.transfersCount),
        gasClaims: stats.map((stat) => stat.gasClaimsCount),
        others: stats.map((stat) => stat.othersCount),
        realUsage: stats.map((stat) => stat.realUsageTotal),
        totalTxs: stats.map((stat) => stat.totalTxCount),
        activeAddresses: stats.map((stat) => stat.uniqueAddresses),
        neoVolume: stats.map((stat) => toNumber(stat.neoVolumeRaw, 0)),
        gasVolume: stats.map((stat) => toNumber(stat.gasVolumeRaw, 8)),
      },
      assets: {
        labels: assetLabels,
        values: assetValues,
      },
    };
  }

  private normalizeAssetLabel(label?: string | null, fallback?: string | null): string {
    const value = (label ?? fallback ?? '').trim();
    if (!value) {
      return 'Unknown';
    }

    return value;
  }

  private async buildAssetLabelMap(
    assets: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const uniqueAssets = new Set<string>();
    for (const asset of assets) {
      if (!asset) {
        continue;
      }

      uniqueAssets.add(asset);
    }

    const resolutionPromises: Array<Promise<void>> = [];
    for (const asset of uniqueAssets) {
      resolutionPromises.push(
        (async () => {
          const label = await this.resolveAssetLabel(asset);
          labels.set(asset, label);
        })(),
      );
    }

    await Promise.all(resolutionPromises);
    return labels;
  }

  private async buildAssetDecimalsMap(
    assets: Array<string | null | undefined>,
  ): Promise<Map<string, number>> {
    const decimals = new Map<string, number>();
    const uniqueAssets = new Set<string>();
    for (const asset of assets) {
      if (!asset) {
        continue;
      }

      uniqueAssets.add(asset);
    }

    const resolutionPromises: Array<Promise<void>> = [];
    for (const asset of uniqueAssets) {
      resolutionPromises.push(
        (async () => {
          const resolved = await this.resolveAssetDecimals(asset);
          if (resolved !== null) {
            decimals.set(asset, resolved);
          }
        })(),
      );
    }

    await Promise.all(resolutionPromises);

    return decimals;
  }

  private getAssetLabel(asset: string | null | undefined, labels: Map<string, string>): string {
    if (!asset) {
      return '';
    }

    return labels.get(asset) ?? asset;
  }

  private getAssetDecimals(
    asset: string | null | undefined,
    decimalsMap: Map<string, number>,
  ): number | null {
    if (!asset) {
      return null;
    }

    return decimalsMap.get(asset) ?? null;
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

      console.debug(
        `Asset label resolution returned no value for asset "${asset}", falling back to asset hash.`,
      );
    } catch (error) {
      console.warn(
        `Failed to resolve asset label for asset "${asset}", falling back to asset hash.`,
        error,
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
      console.warn(
        `Failed to resolve asset decimals for "${asset}", falling back to defaults.`,
        error,
      );

      return null;
    }
  }

  private resolveDayPageSize(value?: string): number {
    const requested = this.parsePositiveInt(value, this.defaultDayPageSize);
    const clamped = Math.min(Math.max(requested, 1), this.maxDayPageSize);
    if (this.dayPageSizeOptions.includes(clamped)) {
      return clamped;
    }

    return this.defaultDayPageSize;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return fallback;
    }

    return parsed;
  }

  private shortenAddress(value?: string) {
    if (!value) {
      return '';
    }

    if (value.length <= 12) {
      return value;
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  private formatAmount(asset: string | null | undefined, value: bigint, decimals?: number | null) {
    if (typeof decimals === 'number') {
      return formatUnits(value, decimals);
    }

    if (!asset) {
      return formatUnits(value, 0);
    }

    if (asset.trim().toUpperCase() === 'GAS') {
      return formatUnits(value, 8);
    }

    return formatUnits(value, 0);
  }

  private formatUsd(value: string | Prisma.Decimal): string {
    let decimalValue: Prisma.Decimal;
    try {
      decimalValue = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
    } catch (_error) {
      return '$0.00';
    }

    const rounded = decimalValue.toDecimalPlaces(2);
    const isNegative = rounded.isNegative();
    const absolute = isNegative ? rounded.negated() : rounded;
    const [wholePart, fractionPart = '00'] = absolute.toFixed(2).split('.');
    const groupedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${isNegative ? '-' : ''}$${groupedWhole}.${fractionPart}`;
  }
}
