import { Controller, Get, Inject, Param, Query, Redirect, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { StatsService } from '../stats/stats.service';
import type { SwapUsdCoverage } from '../stats/stats.service.types';
import { formatNumber, formatUnits, toNumber } from '../stats/stats.utils';
import { getAddressLabel } from './address-labels';
import { DefiLiquidityService } from './defi-liquidity.service';
import { countInclusiveDays, normalizeIsoDate, resolveDefiWindow } from './defi-metrics';
import { buildRecentVolumeNotice, resolveRecentVolumeWindow } from './defi-recent-volume';
import { renderReactPage } from './react-view';
import {
  joinSiteUrl,
  normalizeSiteUrl,
  renderLlmsTxt,
  renderRobotsTxt,
  renderSitemapXml,
} from './seo';
import type { LlmsEntry, SitemapEntry } from './seo';
import { TokenPerformanceService } from './token-performance.service';
import type { StatTotals } from './web.controller.types';

const STATIC_SITEMAP_ENTRIES: SitemapEntry[] = [
  {
    path: '/dashboard',
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    path: '/defi',
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    path: '/days',
    changeFrequency: 'daily',
    priority: 0.8,
  },
  {
    path: '/faq',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/special-thanks',
    changeFrequency: 'monthly',
    priority: 0.4,
  },
];

const LLMS_ENTRIES: LlmsEntry[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Daily Neo N3 activity totals, charts, address leaders, and asset breakdowns.',
  },
  {
    path: '/defi',
    title: 'DeFi Analytics',
    description: 'DEX volume, tracked liquidity mix, stablecoin share, and recent swap activity.',
  },
  {
    path: '/days',
    title: 'Daily Table',
    description:
      'Calendar-style table of daily transaction, swap, oracle, transfer, and GAS claim counts.',
  },
  {
    path: '/faq',
    title: 'FAQ',
    description:
      'Methodology notes about data sources, metric definitions, and classification rules.',
  },
];

@ApiExcludeController()
@Controller()
export class WebController {
  private readonly dayPageSizeOptions = [25, 50, 100, 200];
  private readonly defaultDayPageSize = 50;
  private readonly maxDayPageSize = 200;
  private readonly millisecondsPerDay = 24 * 60 * 60 * 1000;

  constructor(
    @Inject(StatsService) private readonly statsService: StatsService,
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    @Inject(ConfigService) private readonly configService: ConfigService,
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

  @Get('/robots.txt')
  robots(@Req() req: Request, @Res() res: Response) {
    res.type('text/plain');

    return res.send(renderRobotsTxt(this.resolveSiteUrl(req)));
  }

  @Get('/sitemap.xml')
  async sitemap(@Req() req: Request, @Res() res: Response) {
    const dates = await this.statsService.getLatestStats(365);
    const entries = [
      ...STATIC_SITEMAP_ENTRIES,
      ...dates
        .map((stat) => formatDate(stat.date, 'UTC'))
        .sort((left, right) => left.localeCompare(right))
        .map((date) => ({
          path: `/day/${encodeURIComponent(date)}`,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
          lastModified: date,
        })),
    ];

    res.type('application/xml');

    return res.send(renderSitemapXml(this.resolveSiteUrl(req), entries));
  }

  @Get('/llms.txt')
  llms(@Req() req: Request, @Res() res: Response) {
    res.type('text/plain');

    return res.send(renderLlmsTxt(this.resolveSiteUrl(req), LLMS_ENTRIES));
  }

  @Get('/agents.txt')
  agents(@Req() req: Request, @Res() res: Response) {
    res.type('text/plain');

    return res.send(renderLlmsTxt(this.resolveSiteUrl(req), LLMS_ENTRIES));
  }

  @Get('/faq')
  async faq(@Req() req: Request, @Res() res: Response) {
    const marketPrices = await this.getMarketPrices();

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - FAQ',
        description:
          'FAQ for Neo Analytics covering methodology, metrics, and Neo N3 data sources.',
        canonicalUrl: this.buildCanonicalUrl(req, '/faq'),
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
  async specialThanks(@Req() req: Request, @Res() res: Response) {
    const marketPrices = await this.getMarketPrices();

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - Special thanks',
        description:
          'Credits to the contributors, tools, and data providers behind the Neo Analytics project.',
        canonicalUrl: this.buildCanonicalUrl(req, '/special-thanks'),
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
  async dashboard(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const [{ stats, range }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(from, to, 30),
      this.getMarketPrices(),
    ]);
    const shouldIndexPage = !from && !to;
    const labeledStats = stats.map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
    }));
    const totals = stats[stats.length - 1] ?? this.emptyTotals();

    if (!range) {
      return res.send(
        renderReactPage({
          title: 'Neo Analytics',
          description:
            'Neo N3 analytics dashboard with daily transaction activity, swaps, oracle traffic, transfers, and address trends.',
          canonicalUrl: this.buildCanonicalUrl(req, '/dashboard'),
          robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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
        description:
          'Neo N3 analytics dashboard with daily transaction activity, swaps, oracle traffic, transfers, and address trends.',
        canonicalUrl: this.buildCanonicalUrl(req, '/dashboard'),
        robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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
  async defi(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const [{ stats: latestStats }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(undefined, undefined, 30),
      this.getMarketPrices(),
    ]);
    const shouldIndexPage = !from && !to;
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

    const [assetLabelMap, assetDecimalsMap] = await Promise.all([
      this.buildAssetLabelMap([...swapAssetsToResolve]),
      this.buildAssetDecimalsMap([...swapAssetsToResolve]),
    ]);
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
    const expectedLatestDayLabel = yesterdayInTimeZone('Europe/Warsaw');
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

    return res.send(
      renderReactPage({
        title: 'Neo Analytics - DeFi metrics',
        description:
          'Neo N3 DeFi analytics with DEX volume, tracked liquidity, stablecoin share, token performance, and recent swaps.',
        canonicalUrl: this.buildCanonicalUrl(req, '/defi'),
        robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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
            trackedContracts: trackedLiquidity
              ? formatNumber(trackedLiquidity.trackedContracts)
              : null,
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
  async days(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const [{ stats, range }, marketPrices] = await Promise.all([
      this.statsService.getRangeOrLatest(from, to, 90),
      this.getMarketPrices(),
    ]);
    const shouldIndexPage = !from && !to;
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
          description:
            'Daily Neo N3 activity table with swaps, oracle transactions, transfers, GAS claims, and other usage metrics.',
          canonicalUrl: this.buildCanonicalUrl(req, '/days'),
          robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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
        description:
          'Daily Neo N3 activity table with swaps, oracle transactions, transfers, GAS claims, and other usage metrics.',
        canonicalUrl: this.buildCanonicalUrl(req, '/days'),
        robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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

  @Get('/day/:date')
  async day(
    @Req() req: Request,
    @Res() res: Response,
    @Param('date') date: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const shouldIndexPage = !page && !pageSize;
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
        description: `Neo N3 activity for ${date}, including classified transactions, asset flows, and daily totals.`,
        canonicalUrl: this.buildCanonicalUrl(req, this.buildDayHref(date)),
        robots: shouldIndexPage ? 'index, follow' : 'noindex, follow',
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

  private buildCanonicalUrl(req: Request, path: string): string {
    return joinSiteUrl(this.resolveSiteUrl(req), path);
  }

  private resolveSiteUrl(req: Request): string {
    const configuredSiteUrl = normalizeSiteUrl(this.configService.get<string>('app.siteUrl'));
    if (configuredSiteUrl) {
      return configuredSiteUrl;
    }

    const forwardedProtoHeader = req.headers['x-forwarded-proto'];
    const forwardedProto = Array.isArray(forwardedProtoHeader)
      ? forwardedProtoHeader[0]
      : forwardedProtoHeader;
    const protocol = forwardedProto?.split(',')[0]?.trim() || req.protocol || 'http';
    const forwardedHostHeader = req.headers['x-forwarded-host'];
    const forwardedHost = Array.isArray(forwardedHostHeader)
      ? forwardedHostHeader[0]
      : forwardedHostHeader;
    const host = (forwardedHost || req.get('host') || 'localhost:3000').split(',')[0].trim();

    return normalizeSiteUrl(`${protocol}://${host}`) ?? 'http://localhost:3000';
  }

  private buildDayHref(date: string): string {
    if (!date) {
      return '/days';
    }

    return `/day/${encodeURIComponent(date)}`;
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

  private async getMarketPrices() {
    return this.tokenPerformanceService.getMarketPrices();
  }
}
