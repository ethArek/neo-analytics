import { Controller, Get, Inject, Param, Query, Redirect, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { formatDate } from '../ingestion/date-utils';
import { StatsService } from '../stats/stats.service';
import { formatNumber, formatUnits, toNumber } from '../stats/stats.utils';
import { NeoClient } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';

type StatTotals = {
  totalTxCount: number;
  swapsCount: number;
  transfersCount: number;
  gasClaimsCount: number;
  ignoredCount: number;
  realUsageTotal: number;
  totalTransfers: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  uniqueAddresses: number;
  neoVolumeRaw: bigint;
  gasVolumeRaw: bigint;
  blockCount: number;
};

@ApiExcludeController()
@Controller()
export class WebController {
  constructor(
    private readonly statsService: StatsService,
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
  ) {}

  @Get('/favicon.ico')
  @Redirect('/favicon.svg', 302)
  favicon() {}

  @Get('/')
  @Redirect('/dashboard', 302)
  root() {}

  @Get('/faq')
  @Render('faq')
  faq() {
    return {
      nav: {
        faq: true,
      },
    };
  }

  @Get('/dashboard')
  @Render('dashboard')
  async dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to, 30);
    const labeledStats = stats.map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
    }));
    const totals = stats[stats.length - 1] ?? this.emptyTotals();

    if (!range) {
      return {
        nav: {
          dashboard: true,
        },
        stats: labeledStats,
        totals: this.formatTotals(totals),
        chartData: JSON.stringify(this.buildChartData(labeledStats, [])),
        rangeLabel: 'No data available',
        rangeFrom: '',
        rangeTo: '',
        topSenders: [],
        topReceivers: [],
      };
    }

    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);
    const [assetStats, topSenders, topReceivers] = await Promise.all([
      this.statsService.getAssetStatsRange(rangeFrom, rangeTo),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'from', 6),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'to', 6),
    ]);
    const assetLabelMap = await this.buildAssetLabelMap(
      assetStats.map((asset) => asset.asset),
    );
    const labeledAssetStats = assetStats.map((asset) => ({
      ...asset,
      assetLabel: assetLabelMap.get(asset.asset) ?? asset.asset,
    }));
    const chartData = this.buildChartData(labeledStats, labeledAssetStats);

    return {
      nav: {
        dashboard: true,
      },
      stats: labeledStats,
      totals: this.formatTotals(totals),
      chartData: JSON.stringify(chartData),
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
    };
  }

  @Get('/days')
  @Render('days')
  async days(@Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to, 90);
    const labeledStats = stats.map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
      totalTxCountLabel: formatNumber(stat.totalTxCount),
      swapsCountLabel: formatNumber(stat.swapsCount),
      transfersCountLabel: formatNumber(stat.transfersCount),
      gasClaimsCountLabel: formatNumber(stat.gasClaimsCount),
      realUsageTotalLabel: formatNumber(stat.realUsageTotal),
    }));

    if (!range) {
      return {
        nav: {
          dashboard: true,
        },
        stats: labeledStats,
        rangeLabel: 'No data available',
        rangeFrom: '',
        rangeTo: '',
      };
    }

    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);

    return {
      nav: {
        dashboard: true,
      },
      stats: labeledStats,
      rangeLabel: `${rangeFrom} to ${rangeTo}`,
      rangeFrom,
      rangeTo,
    };
  }

  @Get('/day/:date')
  @Render('day')
  async day(@Param('date') date: string) {
    const { stat, transactions, assetStats, methodStats, contractStats } =
      await this.statsService.getDayDetails(date);
    const assetLabelMap = await this.buildAssetLabelMap([
      ...assetStats.map((asset) => asset.asset),
      ...transactions.map((transaction) => transaction.asset),
    ]);

    const formattedTransactions = transactions.map((tx) => ({
      ...tx,
      timestampLabel: new Date(tx.timestamp).toISOString(),
      amountLabel: this.formatAmount(tx.asset, tx.amountRaw ?? 0n),
      assetLabel: this.getAssetLabel(tx.asset, assetLabelMap),
      shortTxid: this.shortenAddress(tx.txid),
    }));

    return {
      nav: {
        dashboard: true,
      },
      date,
      stat: stat ? this.formatStat(stat) : null,
      transactions: formattedTransactions,
      assetStats: assetStats.map((asset) => ({
        ...asset,
        assetLabel: this.getAssetLabel(asset.asset, assetLabelMap),
        volumeLabel: this.formatAmount(asset.asset, asset.volumeRaw),
      })),
      methodStats: methodStats.sort((a, b) => b.txCount - a.txCount),
      contractStats: contractStats.sort((a, b) => b.txCount - a.txCount),
    };
  }

  private emptyTotals(): StatTotals {
    return {
      totalTxCount: 0,
      swapsCount: 0,
      transfersCount: 0,
      gasClaimsCount: 0,
      ignoredCount: 0,
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
      ...stat,
      neoVolume: this.formatAmount('NEO', stat.neoVolumeRaw),
      gasVolume: this.formatAmount('GAS', stat.gasVolumeRaw),
    };
  }

  private buildChartData(
    stats: Array<Awaited<ReturnType<StatsService['getLatestStats']>>[number] & { dateLabel: string }>,
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
    const assetLabels = topAssets.map((asset) => asset.assetLabel ?? asset.asset);
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

  private async buildAssetLabelMap(
    assets: Array<string | null | undefined>
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const uniqueAssets = new Set<string>();
    for (const asset of assets) {
      if (!asset) {
        continue;
      }

      uniqueAssets.add(asset);
    }

    for (const asset of uniqueAssets) {
      const label = await this.resolveAssetLabel(asset);
      labels.set(asset, label);
    }

    return labels;
  }

  private getAssetLabel(
    asset: string | null | undefined,
    labels: Map<string, string>
  ): string {
    if (!asset) {
      return '';
    }

    return labels.get(asset) ?? asset;
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
    } catch (error) {
      return asset;
    }

    return asset;
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

  private formatAmount(asset: string | null | undefined, value: bigint) {
    if (!asset) {
      return formatUnits(value, 0);
    }

    if (asset === 'GAS') {
      return formatUnits(value, 8);
    }

    return formatUnits(value, 0);
  }
}
