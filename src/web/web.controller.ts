import { Controller, Get, Param, Query, Render } from '@nestjs/common';
import { formatDate } from '../ingestion/date-utils';
import { StatsService } from '../stats/stats.service';
import { formatNumber, formatUnits, toNumber } from '../stats/stats.utils';

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

@Controller()
export class WebController {
  constructor(private readonly statsService: StatsService) {}

  @Get('/')
  @Render('dashboard')
  async dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to, 30);
    const labeledStats = stats.map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
    }));
    const totals = this.sumStats(stats);

    if (!range) {

      return {
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
    const [assetStats, topSenders, topReceivers, addressTotals] = await Promise.all([
      this.statsService.getAssetStatsRange(rangeFrom, rangeTo),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'from', 6),
      this.statsService.getTopAddresses(rangeFrom, rangeTo, 'to', 6),
      this.statsService.getUniqueAddressStatsRange(rangeFrom, rangeTo),
    ]);

    totals.uniqueSenders = addressTotals.uniqueSenders;
    totals.uniqueReceivers = addressTotals.uniqueReceivers;
    totals.uniqueAddresses = addressTotals.uniqueAddresses;

    const chartData = this.buildChartData(labeledStats, assetStats);

    return {
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
        stats: labeledStats,
        rangeLabel: 'No data available',
        rangeFrom: '',
        rangeTo: '',
      };
    }

    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);

    return {
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

    const formattedTransactions = transactions.map((tx) => ({
      ...tx,
      timestampLabel: new Date(tx.timestamp).toISOString(),
      amountLabel: this.formatAmount(tx.asset, tx.amountRaw ?? 0n),
      shortTxid: this.shortenAddress(tx.txid),
    }));

    return {
      date,
      stat: stat ? this.formatStat(stat) : null,
      transactions: formattedTransactions,
      assetStats: assetStats.map((asset) => ({
        ...asset,
        volumeLabel: this.formatAmount(asset.asset, asset.volumeRaw),
      })),
      methodStats: methodStats.sort((a, b) => b.txCount - a.txCount),
      contractStats: contractStats.sort((a, b) => b.txCount - a.txCount),
    };
  }

  private sumStats(
    stats: Array<Awaited<ReturnType<StatsService['getLatestStats']>>[number]>,
  ): StatTotals {
    return stats.reduce(
      (acc, stat) => ({
        ...acc,
        totalTxCount: acc.totalTxCount + stat.totalTxCount,
        swapsCount: acc.swapsCount + stat.swapsCount,
        transfersCount: acc.transfersCount + stat.transfersCount,
        gasClaimsCount: acc.gasClaimsCount + stat.gasClaimsCount,
        ignoredCount: acc.ignoredCount + stat.ignoredCount,
        realUsageTotal: acc.realUsageTotal + stat.realUsageTotal,
        totalTransfers: acc.totalTransfers + stat.totalTransfers,
        uniqueSenders: acc.uniqueSenders + stat.uniqueSenders,
        uniqueReceivers: acc.uniqueReceivers + stat.uniqueReceivers,
        uniqueAddresses: acc.uniqueAddresses + stat.uniqueAddresses,
        neoVolumeRaw: acc.neoVolumeRaw + stat.neoVolumeRaw,
        gasVolumeRaw: acc.gasVolumeRaw + stat.gasVolumeRaw,
        blockCount: acc.blockCount + stat.blockCount,
      }),
      {
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
      },
    );
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
    assetStats: Awaited<ReturnType<StatsService['getAssetStatsRange']>>,
  ) {
    const labels = stats.map((stat) => stat.dateLabel);
    const assetsSorted = [...assetStats].sort((a, b) => b.transferCount - a.transferCount);
    const topAssets = assetsSorted.slice(0, 5);
    const remainingAssets = assetsSorted.slice(5);
    const otherTransfers = remainingAssets.reduce((total, asset) => total + asset.transferCount, 0);
    const assetLabels = topAssets.map((asset) => asset.asset);
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
