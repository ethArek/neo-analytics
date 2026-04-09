import { Controller, Get, Inject, Param, Query, Redirect, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { isStablecoinSymbol, normalizeAsset } from '../common/normalize.utils';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';
import { StatsService } from '../stats/stats.service';
import type { SwapUsdCoverage } from '../stats/stats.service.types';
import { formatNumber, formatUnits, toNumber } from '../stats/stats.utils';
import { getAddressLabel } from './address-labels';
import { AssetMetadataService } from './asset-metadata.service';
import { DefiLiquidityService } from './defi-liquidity.service';
import { countInclusiveDays, normalizeIsoDate, resolveDefiWindow } from './defi-metrics';
import {
  buildRecentVolumeNotice,
  resolveFlamingoRecentVolume,
  resolveRecentVolumeWindow,
} from './defi-recent-volume';
import { renderReactPage } from './react-view';
import { TokenPerformanceService } from './token-performance.service';
import type { StatTotals } from './web.controller.types';

@ApiExcludeController()
@Controller()
export class WebController {
  private readonly dayPageSizeOptions = [25, 50, 100, 200];
  private readonly defaultDayPageSize = 50;
  private readonly maxDayPageSize = 200;
  private readonly millisecondsPerDay = 24 * 60 * 60 * 1000;

  constructor(
    @Inject(StatsService) private readonly statsService: StatsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(AssetMetadataService)
    private readonly assetMetadataService: AssetMetadataService,
    @Inject(TokenPerformanceService)
    private readonly tokenPerformanceService: TokenPerformanceService,
    @Inject(DefiLiquidityService)
    private readonly defiLiquidityService: DefiLiquidityService,
  ) {}

  @Get('/favicon.ico')
  @Redirect('/favicon.svg', 302)
  favicon() {}

  @Get('/')
  @Redirect('/dashboard', 302)
  root() {}

  @Get('/faq')
  async faq(@Res() res: Response) {
    const marketPrices = await this.getMarketPrices();

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - FAQ',
        page: 'faq',
        data: {
          marketPrices,
          nav: {
            faq: true,
          },
        },
      }),
    );
  }

  @Get('/special-thanks')
  async specialThanks(@Res() res: Response) {
    const marketPrices = await this.getMarketPrices();

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - Special thanks',
        page: 'special-thanks',
        data: {
          marketPrices,
          nav: {
            specialThanks: true,
          },
        },
      }),
    );
  }

  @Get('/dashboard')
  async dashboard(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const [{ stats, range }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(from, to, 30),
      this.getMarketPrices(),
    ]);
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
            marketPrices,
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
        assetHref: this.buildAssetHref(asset.asset, rangeFrom, rangeTo),
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
          marketPrices,
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
            addressLabel: getAddressLabel(entry.address),
            transferCount: formatNumber(entry.transferCount),
          })),
          topReceivers: topReceivers.map((entry) => ({
            address: entry.address,
            shortAddress: this.shortenAddress(entry.address),
            addressLabel: getAddressLabel(entry.address),
            transferCount: formatNumber(entry.transferCount),
          })),
          assetBreakdown,
        },
      }),
    );
  }

  @Get('/defi')
  async defi(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const [{ stats: latestStats }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(undefined, undefined, 30),
      this.getMarketPrices(),
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
    const [trackedLiquidity, tokenPerformanceFilters] = await Promise.all([
      this.defiLiquidityService.getTrackedLiquiditySnapshot(),
      this.buildDefiTokenPerformanceFilters(defaultRange.to),
    ]);
    const [tokenPerformance, rangeData] = await Promise.all([
      this.tokenPerformanceService.getDashboardTokenPerformance(tokenPerformanceFilters),
      this.getDefiRangeData(window),
    ]);
    const { stats, swapAddressStats, topSwapAssets, largestSwaps, recentSwaps } = rangeData;

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
    const totalActivity = stats.reduce((total, stat) => total + stat.realUsageTotal, 0);
    const rangeFrom = window.effectiveFrom ?? window.requestedFrom ?? '';
    const rangeTo = window.effectiveTo ?? window.requestedTo ?? rangeFrom;
    const rangeLabel = rangeFrom && rangeTo ? `${rangeFrom} to ${rangeTo}` : 'No data available';
    const swapAssetsToResolve = new Set<string>();
    for (const asset of topSwapAssets) {
      if (asset.asset) {
        swapAssetsToResolve.add(asset.asset);
      }
    }

    for (const transaction of largestSwaps) {
      if (transaction.asset) {
        swapAssetsToResolve.add(transaction.asset);
      }
    }

    for (const transaction of recentSwaps) {
      if (transaction.asset) {
        swapAssetsToResolve.add(transaction.asset);
      }
    }

    const [assetLabelMap, assetDecimalsMap, flamingoRecentVolumeRows] = await Promise.all([
      this.buildAssetLabelMap([...swapAssetsToResolve]),
      this.buildAssetDecimalsMap([...swapAssetsToResolve]),
      this.tokenPerformanceService.getRollingDexVolumeRows(),
    ]);
    const expectedLatestDayLabel = yesterdayInTimeZone('Europe/Warsaw');
    const flamingoRecentVolume = resolveFlamingoRecentVolume({
      rows: flamingoRecentVolumeRows,
      expectedLatestDayLabel,
    });
    const localRecentVolume = flamingoRecentVolume
      ? null
      : await this.buildLocalRecentVolumeOverview(
          latestStats,
          availableFrom,
          expectedLatestDayLabel,
        );
    const recentVolumeOverview = flamingoRecentVolume
      ? {
          latestDayDexVolume: this.formatUsd(flamingoRecentVolume.latestDayVolume),
          latestDayLabel: flamingoRecentVolume.latestDayLabel,
          last7dDexVolume: this.formatUsd(flamingoRecentVolume.last7dVolume),
          last7dLabel: flamingoRecentVolume.last7dLabel,
          recentVolumeNotice: flamingoRecentVolume.notice,
        }
      : (localRecentVolume ?? {
          latestDayDexVolume: this.formatUsd(0),
          latestDayLabel: 'No data available',
          last7dDexVolume: this.formatUsd(0),
          last7dLabel: 'No data available',
          recentVolumeNotice: null,
        });

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - DeFi metrics',
        page: 'defi',
        data: {
          marketPrices,
          nav: {
            defi: true,
          },
          tokenPerformance,
          rangeLabel,
          rangeFrom,
          rangeTo,
          totals: hasStats
            ? {
                estimatedSwapUsdValue: this.formatUsd(totalSwapUsdValue),
                swaps: formatNumber(totalSwaps),
                averageSwapUsdValue: this.formatUsd(averageSwapUsdValue),
                coveredDays: formatNumber(coveredDays),
                requestedDays: formatNumber(requestedDays),
                activityShare: this.formatPercentValue(totalSwaps, totalActivity),
                activeSwapWallets: formatNumber(swapAddressStats.uniqueAddresses),
              }
            : null,
          onChainOverview: {
            latestDayDexVolume: recentVolumeOverview.latestDayDexVolume,
            latestDayLabel: recentVolumeOverview.latestDayLabel,
            last7dDexVolume: recentVolumeOverview.last7dDexVolume,
            last7dLabel: recentVolumeOverview.last7dLabel,
            recentVolumeNotice: recentVolumeOverview.recentVolumeNotice,
            trackedTvl: trackedLiquidity ? this.formatUsd(trackedLiquidity.trackedTvlUsd) : null,
            stablecoinLiquidity: trackedLiquidity
              ? this.formatUsd(trackedLiquidity.stablecoinLiquidityUsd)
              : null,
            stablecoinShare: trackedLiquidity
              ? this.formatPercentValue(
                  trackedLiquidity.stablecoinLiquidityUsd,
                  trackedLiquidity.trackedTvlUsd,
                )
              : null,
            poolCount: trackedLiquidity ? formatNumber(trackedLiquidity.poolCount) : null,
            pricedAssets: trackedLiquidity ? formatNumber(trackedLiquidity.pricedAssets) : null,
            topLiquidityAssets:
              trackedLiquidity?.topAssets.map((asset) => ({
                symbol: asset.symbol,
                balanceLabel: this.formatTokenBalance(asset.balance),
                usdValueLabel: this.formatUsd(asset.usdValue),
                stablecoin: asset.stablecoin,
              })) ?? [],
          },
          topSwapAssets: topSwapAssets.map((asset) => ({
            assetLabel: this.getAssetLabel(asset.asset, assetLabelMap),
            swaps: formatNumber(asset.swapCount),
            usdVolume: this.formatUsd(asset.totalUsdValue),
            averageSwapUsdValue: this.formatUsd(asset.averageUsdValue),
          })),
          largestSwaps: largestSwaps.map((transaction) => ({
            txid: transaction.txid,
            shortTxid: this.shortenAddress(transaction.txid),
            timestampLabel: this.formatTimestampLabel(transaction.timestamp),
            dayLabel: formatDate(transaction.date, 'UTC'),
            dayHref: this.buildDayHref(formatDate(transaction.date, 'UTC')),
            assetLabel: this.getAssetLabel(transaction.asset, assetLabelMap),
            amountLabel:
              transaction.amountRaw === null
                ? '-'
                : this.formatAmount(
                    transaction.asset,
                    transaction.amountRaw,
                    this.getAssetDecimals(transaction.asset, assetDecimalsMap),
                  ),
            usdValueLabel: this.formatUsd(transaction.swapUsdValue ?? '0'),
            method: transaction.method,
          })),
          recentSwaps: recentSwaps.map((transaction) => ({
            txid: transaction.txid,
            shortTxid: this.shortenAddress(transaction.txid),
            timestampLabel: this.formatTimestampLabel(transaction.timestamp),
            dayLabel: formatDate(transaction.date, 'UTC'),
            dayHref: this.buildDayHref(formatDate(transaction.date, 'UTC')),
            assetLabel: this.getAssetLabel(transaction.asset, assetLabelMap),
            amountLabel:
              transaction.amountRaw === null
                ? '-'
                : this.formatAmount(
                    transaction.asset,
                    transaction.amountRaw,
                    this.getAssetDecimals(transaction.asset, assetDecimalsMap),
                  ),
            usdValueLabel: this.formatUsd(transaction.swapUsdValue ?? '0'),
            method: transaction.method,
          })),
          chartData: hasStats ? this.buildDefiChartData(stats) : null,
        },
      }),
    );
  }
  @Get('/days')
  async days(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const [{ stats, range }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(from, to, 90),
      this.getMarketPrices(),
    ]);
    const labeledStats = stats.map((stat) => ({
      dateLabel: formatDate(stat.date),
      totalTxCountLabel: formatNumber(stat.totalTxCount),
      swapsCountLabel: formatNumber(stat.swapsCount),
      oracleCountLabel: formatNumber(stat.oracleCount),
      transfersCountLabel: formatNumber(stat.transfersCount),
      gasClaimsCountLabel: formatNumber(stat.gasClaimsCount),
      othersCountLabel: formatNumber(stat.othersCount),
      transactionsExcludingGasClaimsLabel: formatNumber(stat.realUsageTotal),
    }));

    if (!range) {
      return res.send(
        renderReactPage({
          title: 'Neo Analytics - Daily table',
          page: 'days',
          data: {
            marketPrices,
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
          marketPrices,
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

  @Get('/asset/:asset')
  async asset(
    @Res() res: Response,
    @Param('asset') asset: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const normalizedAsset = normalizeAsset(asset) ?? asset.trim();
    const [{ range }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(from, to, 30),
      this.getMarketPrices(),
    ]);
    const [assetMetadata, assetMarketSnapshot, trackedLiquidityAsset] = await Promise.all([
      this.assetMetadataService.getAssetMetadata(normalizedAsset),
      this.tokenPerformanceService.getAssetMarketSnapshot(normalizedAsset),
      this.defiLiquidityService.getTrackedLiquidityAsset(normalizedAsset),
    ]);
    const { label: assetLabel, decimals: assetDecimals } = assetMetadata;
    const rangeFrom = range ? formatDate(range.from) : '';
    const rangeTo = range ? formatDate(range.to) : '';
    const rangeLabel = range ? `${rangeFrom} to ${rangeTo}` : 'No data available';

    if (!range) {
      return res.send(
        renderReactPage({
          title: `Neo Analytics - ${assetLabel}`,
          page: 'asset',
          data: {
            marketPrices,
            nav: {
              dashboard: true,
            },
            assetLabel,
            assetId: normalizedAsset,
            rangeLabel,
            rangeFrom,
            rangeTo,
            summary: null,
            defiRelation: this.buildAssetDefiRelation({
              assetLabel,
              assetMarketSnapshot,
              trackedLiquidityAsset,
            }),
            typeBreakdown: [],
            dailyActivity: [],
            topSenders: [],
            topReceivers: [],
            recentTransactions: [],
          },
        }),
      );
    }

    const [
      assetDailyStats,
      uniqueAddressStats,
      typeBreakdown,
      topSenders,
      topReceivers,
      recentTransactions,
    ] = await Promise.all([
      this.statsService.getAssetDailyStatsRange(normalizedAsset, rangeFrom, rangeTo),
      this.statsService.getAssetUniqueAddressStatsRange(normalizedAsset, rangeFrom, rangeTo),
      this.statsService.getAssetTransactionTypeBreakdownRange(normalizedAsset, rangeFrom, rangeTo),
      this.statsService.getTopAssetAddresses(normalizedAsset, rangeFrom, rangeTo, 'from', 6),
      this.statsService.getTopAssetAddresses(normalizedAsset, rangeFrom, rangeTo, 'to', 6),
      this.statsService.getRecentAssetTransactionsRange(normalizedAsset, rangeFrom, rangeTo, 12),
    ]);
    const totalTransferCount = assetDailyStats.reduce(
      (total, stat) => total + stat.transferCount,
      0,
    );
    const totalTxCount = assetDailyStats.reduce((total, stat) => total + stat.txCount, 0);
    const totalVolumeRaw = assetDailyStats.reduce((total, stat) => total + stat.volumeRaw, 0n);
    const typeCountByType = new Map(typeBreakdown.map((entry) => [entry.type, entry.txCount]));
    const swapCount = typeCountByType.get('SWAP') ?? 0;
    const transferCount = typeCountByType.get('NORMAL_TRANSFER') ?? 0;
    const oracleCount = typeCountByType.get('ORACLE') ?? 0;
    const gasClaimCount = typeCountByType.get('GAS_CLAIM') ?? 0;
    const ignoredCount = typeCountByType.get('IGNORED') ?? 0;
    const remainingCount = Math.max(0, totalTxCount - swapCount - transferCount);
    const hasAssetActivity =
      totalTransferCount > 0 ||
      totalTxCount > 0 ||
      uniqueAddressStats.uniqueAddresses > 0 ||
      recentTransactions.length > 0;

    return res.send(
      renderReactPage({
        title: `Neo Analytics - ${assetLabel}`,
        page: 'asset',
        data: {
          marketPrices,
          nav: {
            dashboard: true,
          },
          assetLabel,
          assetId: normalizedAsset,
          rangeLabel,
          rangeFrom,
          rangeTo,
          summary: hasAssetActivity
            ? {
                volumeLabel: this.formatAmount(normalizedAsset, totalVolumeRaw, assetDecimals),
                transferCount: formatNumber(totalTransferCount),
                txCount: formatNumber(totalTxCount),
                activeAddresses: formatNumber(uniqueAddressStats.uniqueAddresses),
                uniqueSenders: formatNumber(uniqueAddressStats.uniqueSenders),
                uniqueReceivers: formatNumber(uniqueAddressStats.uniqueReceivers),
                swapsCount: formatNumber(swapCount),
                transfersCount: formatNumber(transferCount),
                otherCount: formatNumber(remainingCount),
                swapShare: this.formatPercentValue(swapCount, totalTxCount),
                transferShare: this.formatPercentValue(transferCount, totalTxCount),
                oracleCount: formatNumber(oracleCount),
                gasClaimsCount: formatNumber(gasClaimCount),
                ignoredCount: formatNumber(ignoredCount),
              }
            : null,
          defiRelation: this.buildAssetDefiRelation({
            assetLabel,
            assetMarketSnapshot,
            trackedLiquidityAsset,
          }),
          typeBreakdown: typeBreakdown.map((entry) => ({
            key: entry.type,
            label: this.formatTransactionTypeLabel(entry.type),
            count: formatNumber(entry.txCount),
            share: this.formatPercentValue(entry.txCount, totalTxCount),
          })),
          dailyActivity: assetDailyStats.map((stat) => {
            const dateLabel = formatDate(stat.date, 'UTC');

            return {
              dateLabel,
              dayHref: this.buildDayHref(dateLabel),
              transferCount: formatNumber(stat.transferCount),
              txCount: formatNumber(stat.txCount),
              uniqueSenders: formatNumber(stat.uniqueSenders),
              uniqueReceivers: formatNumber(stat.uniqueReceivers),
              volumeLabel: this.formatAmount(normalizedAsset, stat.volumeRaw, assetDecimals),
            };
          }),
          topSenders: topSenders.map((entry) => ({
            address: entry.address,
            shortAddress: this.shortenAddress(entry.address),
            addressLabel: getAddressLabel(entry.address),
            transferCount: formatNumber(entry.transferCount),
            volumeLabel: this.formatAmount(normalizedAsset, entry.volumeRaw, assetDecimals),
          })),
          topReceivers: topReceivers.map((entry) => ({
            address: entry.address,
            shortAddress: this.shortenAddress(entry.address),
            addressLabel: getAddressLabel(entry.address),
            transferCount: formatNumber(entry.transferCount),
            volumeLabel: this.formatAmount(normalizedAsset, entry.volumeRaw, assetDecimals),
          })),
          recentTransactions: recentTransactions.map((transaction) => {
            const dayLabel = formatDate(transaction.date, 'UTC');

            return {
              txid: transaction.txid,
              shortTxid: this.shortenAddress(transaction.txid),
              timestampLabel: this.formatTimestampLabel(transaction.timestamp),
              dayLabel,
              dayHref: this.buildDayHref(dayLabel),
              type: this.formatTransactionTypeLabel(transaction.type),
              amountLabel: this.formatAmount(normalizedAsset, transaction.amountRaw, assetDecimals),
              transferCount: formatNumber(transaction.transferCount),
              method: transaction.method,
            };
          }),
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
    const [{ stat, transactions, assetStats, pagination }, marketPrices] = await Promise.all([
      this.statsService.getDayDetails(date, {
        page: requestedPage,
        pageSize: requestedPageSize,
      }),
      this.getMarketPrices(),
    ]);
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
      type: this.formatTransactionTypeLabel(tx.type),
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
          marketPrices,
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
            assetHref: this.buildAssetHref(asset.asset, date, date),
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

  private async getDefiRangeData(window: ReturnType<typeof resolveDefiWindow>) {
    if (
      (window.status !== 'ready' && window.status !== 'partial') ||
      !window.effectiveFrom ||
      !window.effectiveTo
    ) {
      return {
        stats: [] as Awaited<ReturnType<StatsService['getLatestStats']>>,
        swapAddressStats: {
          uniqueSenders: 0,
          uniqueReceivers: 0,
          uniqueAddresses: 0,
        },
        topSwapAssets: [] as Awaited<ReturnType<StatsService['getSwapAssetStatsRange']>>,
        largestSwaps: [] as Awaited<ReturnType<StatsService['getLargestSwapTransactionsRange']>>,
        recentSwaps: [] as Awaited<ReturnType<StatsService['getRecentSwapTransactionsRange']>>,
      };
    }

    const [stats, swapAddressStats, topSwapAssets, largestSwaps, recentSwaps] = await Promise.all([
      this.statsService.getStatsRange(window.effectiveFrom, window.effectiveTo),
      this.statsService.getSwapAddressStatsRange(window.effectiveFrom, window.effectiveTo),
      this.statsService.getSwapAssetStatsRange(window.effectiveFrom, window.effectiveTo, 6),
      this.statsService.getLargestSwapTransactionsRange(
        window.effectiveFrom,
        window.effectiveTo,
        6,
      ),
      this.statsService.getRecentSwapTransactionsRange(window.effectiveFrom, window.effectiveTo, 6),
    ]);

    return {
      stats,
      swapAddressStats,
      topSwapAssets,
      largestSwaps,
      recentSwaps,
    };
  }

  private async buildDefiTokenPerformanceFilters(latestDate: string | null) {
    if (!latestDate) {
      return {
        last24h: new Set<string>(),
        last7d: new Set<string>(),
        last30d: new Set<string>(),
      };
    }

    const last7dFrom = this.shiftIsoDate(latestDate, -6);
    const last30dFrom = this.shiftIsoDate(latestDate, -29);
    const assetActivity = await this.statsService.getSwapAssetActivityRange(
      last30dFrom,
      latestDate,
    );
    const last24h = new Set<string>();
    const last7d = new Set<string>();
    const last30d = new Set<string>();

    for (const activity of assetActivity) {
      const normalizedAsset = this.normalizeAssetKey(activity.asset);
      if (!normalizedAsset) {
        continue;
      }

      const activityDate = formatDate(activity.date, 'UTC');
      last30d.add(normalizedAsset);
      if (activityDate >= last7dFrom) {
        last7d.add(normalizedAsset);
      }

      if (activityDate === latestDate) {
        last24h.add(normalizedAsset);
      }
    }

    return {
      last24h,
      last7d,
      last30d,
    };
  }

  private shiftIsoDate(value: string, days: number): string {
    const parsed = parseDate(value);
    const shifted = new Date(parsed.getTime() + days * this.millisecondsPerDay);

    return formatDate(shifted, 'UTC');
  }

  private normalizeAssetKey(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('0x')) {
      return trimmed.toLowerCase();
    }

    return trimmed.toUpperCase();
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

  private emptySwapUsdCoverage(): SwapUsdCoverage {
    return {
      swapCount: 0,
      pricedSwapCount: 0,
      missingSwapCount: 0,
    };
  }

  private emptyTotals(): StatTotals {
    return {
      totalTxCount: 0,
      swapsCount: 0,
      swapsUsdValue: '0.00000000',
      oracleCount: 0,
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
      oracle: formatNumber(totals.oracleCount),
      transfers: formatNumber(totals.transfersCount),
      gasClaims: formatNumber(totals.gasClaimsCount),
      others: formatNumber(totals.othersCount),
      transactionsExcludingGasClaims: formatNumber(totals.realUsageTotal),
      totalTxs: formatNumber(totals.totalTxCount),
      totalTransfers: formatNumber(totals.totalTransfers),
      activeAddresses: formatNumber(totals.uniqueAddresses),
      neoVolume: this.formatAmount('NEO', totals.neoVolumeRaw),
      gasVolume: toNumber(totals.gasVolumeRaw, 8).toFixed(2),
      blocks: formatNumber(totals.blockCount),
    };
  }

  private formatStat(stat: StatTotals) {
    return {
      totalTxCount: stat.totalTxCount,
      transactionsExcludingGasClaims: stat.realUsageTotal,
      oracleCount: stat.oracleCount,
      uniqueAddresses: stat.uniqueAddresses,
      neoVolume: this.formatAmount('NEO', stat.neoVolumeRaw),
      gasVolume: this.formatAmount('GAS', stat.gasVolumeRaw),
      othersCount: stat.othersCount,
      blockCount: stat.blockCount,
    };
  }

  private buildChartData(
    stats: Array<
      Awaited<ReturnType<StatsService['getLatestStats']>>[number] & {
        dateLabel: string;
      }
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
        oracle: stats.map((stat) => stat.oracleCount),
        transfers: stats.map((stat) => stat.transfersCount),
        gasClaims: stats.map((stat) => stat.gasClaimsCount),
        others: stats.map((stat) => stat.othersCount),
        transactionsExcludingGasClaims: stats.map((stat) => stat.realUsageTotal),
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
          const metadata = await this.assetMetadataService.getAssetMetadata(asset);
          labels.set(asset, metadata.label);
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
          const metadata = await this.assetMetadataService.getAssetMetadata(asset);
          if (metadata.decimals !== null) {
            decimals.set(asset, metadata.decimals);
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

  private formatPercentValue(value: number, total: number): string {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
      return '0.00%';
    }

    const percent = (value / total) * 100;

    return `${percent.toFixed(2)}%`;
  }

  private formatTokenBalance(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }

    let maximumFractionDigits = 2;
    if (Math.abs(value) > 0 && Math.abs(value) < 1) {
      maximumFractionDigits = 6;
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(value);
  }

  private formatTimestampLabel(value: Date): string {
    return value.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }

  private buildAssetDefiRelation(params: {
    assetLabel: string;
    assetMarketSnapshot: Awaited<ReturnType<TokenPerformanceService['getAssetMarketSnapshot']>>;
    trackedLiquidityAsset: Awaited<ReturnType<DefiLiquidityService['getTrackedLiquidityAsset']>>;
  }) {
    const { assetLabel, assetMarketSnapshot, trackedLiquidityAsset } = params;
    if (!assetMarketSnapshot && !trackedLiquidityAsset) {
      return null;
    }

    const marketSymbol = assetMarketSnapshot?.symbol ?? trackedLiquidityAsset?.symbol ?? assetLabel;

    return {
      marketSymbol,
      currentPrice: assetMarketSnapshot?.currentPrice ?? null,
      change24h: assetMarketSnapshot?.change24h ?? null,
      change7d: assetMarketSnapshot?.change7d ?? null,
      change30d: assetMarketSnapshot?.change30d ?? null,
      trackedLiquidityUsd: trackedLiquidityAsset
        ? this.formatUsd(trackedLiquidityAsset.usdValue)
        : null,
      trackedLiquidityBalance: trackedLiquidityAsset
        ? this.formatTokenBalance(trackedLiquidityAsset.balance)
        : null,
      stablecoin: trackedLiquidityAsset?.stablecoin ?? isStablecoinSymbol(marketSymbol),
      hasMarketPrice: Boolean(assetMarketSnapshot),
      hasTrackedLiquidity: Boolean(trackedLiquidityAsset),
    };
  }

  private buildDayHref(date: string): string {
    if (!date) {
      return '/days';
    }

    return `/day/${encodeURIComponent(date)}`;
  }

  private buildAssetHref(asset: string | null | undefined, from?: string, to?: string): string {
    if (!asset) {
      return '/dashboard';
    }

    const searchParams = new URLSearchParams();
    if (from) {
      searchParams.set('from', from);
    }

    if (to) {
      searchParams.set('to', to);
    }

    const query = searchParams.toString();
    const path = `/asset/${encodeURIComponent(asset)}`;
    if (!query) {
      return path;
    }

    return `${path}?${query}`;
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

  private formatTransactionTypeLabel(value: string) {
    switch (value) {
      case 'SWAP': {
        return 'Swap';
      }
      case 'ORACLE': {
        return 'Oracle';
      }
      case 'NORMAL_TRANSFER': {
        return 'Transfer';
      }
      case 'GAS_CLAIM': {
        return 'GAS claim';
      }
      case 'IGNORED': {
        return 'Other';
      }
      default: {
        return value;
      }
    }
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

  private formatUsd(value: string | number | Prisma.Decimal): string {
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

  private async buildLocalRecentVolumeOverview(
    latestStats: Array<{
      date: Date;
      swapsUsdValue: Prisma.Decimal | string;
    }>,
    availableFrom: string | null,
    expectedLatestDayLabel: string,
  ): Promise<{
    latestDayDexVolume: string;
    latestDayLabel: string;
    last7dDexVolume: string;
    last7dLabel: string;
    recentVolumeNotice: string | null;
  } | null> {
    const latestDay = latestStats[latestStats.length - 1];
    const latestDayLabel = latestDay ? formatDate(latestDay.date, 'UTC') : null;
    const recentVolumeWindow = resolveRecentVolumeWindow(latestDayLabel, availableFrom);
    const recentVolumeStats =
      recentVolumeWindow.from && recentVolumeWindow.to
        ? await this.statsService.getStatsRange(recentVolumeWindow.from, recentVolumeWindow.to)
        : [];
    const latestSevenDayVolume = recentVolumeStats.reduce(
      (total, stat) => total.add(stat.swapsUsdValue),
      new Prisma.Decimal(0),
    );
    const [latestDayCoverage, latestSevenDayCoverage] = await Promise.all([
      latestDayLabel
        ? this.statsService.getSwapUsdCoverageRange(latestDayLabel, latestDayLabel)
        : Promise.resolve(this.emptySwapUsdCoverage()),
      recentVolumeWindow.from && recentVolumeWindow.to
        ? this.statsService.getSwapUsdCoverageRange(recentVolumeWindow.from, recentVolumeWindow.to)
        : Promise.resolve(this.emptySwapUsdCoverage()),
    ]);
    const missingRecentVolumeDays = Math.max(
      0,
      recentVolumeWindow.expectedDays - recentVolumeStats.length,
    );

    return {
      latestDayDexVolume: this.formatUsd(latestDay?.swapsUsdValue ?? '0'),
      latestDayLabel: latestDayLabel ?? 'No data available',
      last7dDexVolume: this.formatUsd(latestSevenDayVolume),
      last7dLabel:
        recentVolumeWindow.from && recentVolumeWindow.to
          ? `${recentVolumeWindow.from} to ${recentVolumeWindow.to}`
          : 'No data available',
      recentVolumeNotice: buildRecentVolumeNotice({
        latestDayLabel,
        expectedLatestDayLabel,
        missingWindowDays: missingRecentVolumeDays,
        latestDayCoverage,
        displayedCoverage: latestSevenDayCoverage,
      }),
    };
  }

  private async getMarketPrices() {
    return this.tokenPerformanceService.getMarketPrices();
  }
}
