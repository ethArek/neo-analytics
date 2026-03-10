import { Body, Controller, Get, Headers, Inject, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';
import { IngestionService } from '../ingestion/ingestion.service';
import { StatsService } from '../stats/stats.service';

@ApiTags('stats')
@Controller('api')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    @Inject(StatsService) private readonly statsService: StatsService,
    @Inject(IngestionService) private readonly ingestionService: IngestionService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Get('stats')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  async stats(@Query('from') from?: string, @Query('to') to?: string) {
    if (from && to) {
      const stats = await this.statsService.getStatsRange(from, to);

      return stats.map((stat) => this.serializeStat(stat));
    }

    const stats = await this.statsService.getLatestStats();

    return stats.map((stat) => this.serializeStat(stat));
  }

  @Get('stats/summary')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    const { stats, range } = await this.statsService.getRangeOrLatest(from, to);
    if (!range) {
      return { range: null, totals: null };
    }

    const totals = this.sumStats(stats);
    const rangeFrom = formatDate(range.from);
    const rangeTo = formatDate(range.to);
    const addressTotals = await this.statsService.getUniqueAddressStatsRange(rangeFrom, rangeTo);
    totals.uniqueSenders = addressTotals.uniqueSenders;
    totals.uniqueReceivers = addressTotals.uniqueReceivers;
    totals.uniqueAddresses = addressTotals.uniqueAddresses;

    return {
      range: { from: rangeFrom, to: rangeTo },
      totals: this.serializeStat(totals),
    };
  }

  @Get('stats/assets')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  async assets(@Query('from') from?: string, @Query('to') to?: string) {
    const { range } = await this.statsService.getRangeOrLatest(from, to);
    if (!range) {
      return [];
    }

    const stats = await this.statsService.getAssetStatsRange(
      formatDate(range.from),
      formatDate(range.to),
    );

    return stats.map((stat) => this.serializeAssetStat(stat));
  }

  @Get('stats/methods')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  async methods(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const { range } = await this.statsService.getRangeOrLatest(from, to);
    if (!range) {
      return [];
    }

    const stats = await this.statsService.getMethodStatsRange(
      formatDate(range.from),
      formatDate(range.to),
    );
    const max = this.parseLimit(limit, 8);

    return stats.slice(0, max);
  }

  @Get('stats/contracts')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  async contracts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const { range } = await this.statsService.getRangeOrLatest(from, to);
    if (!range) {
      return [];
    }

    const stats = await this.statsService.getContractStatsRange(
      formatDate(range.from),
      formatDate(range.to),
    );
    const max = this.parseLimit(limit, 8);

    return stats.slice(0, max);
  }

  @Get('stats/top')
  @ApiQuery({ name: 'from', required: false, example: '2024-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-05-31' })
  @ApiQuery({ name: 'type', required: false, example: 'senders' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  async top(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const { range } = await this.statsService.getRangeOrLatest(from, to);
    if (!range) {
      return [];
    }

    const direction = type === 'receivers' ? 'to' : 'from';
    const max = this.parseLimit(limit, 8);
    const stats = await this.statsService.getTopAddresses(
      formatDate(range.from),
      formatDate(range.to),
      direction,
      max,
    );

    return stats.map((stat) => this.serializeTopAddress(stat));
  }

  @Post('jobs/run')
  @ApiExcludeEndpoint()
  async runJob(@Body('date') date?: string) {
    const target = date ?? yesterdayInTimeZone('Europe/Warsaw');
    this.logger.log(`Manual ingestion requested for ${target}.`);
    await this.ingestionService.ingestDay(target);

    return { status: 'ok', date: target };
  }

  @Post('jobs/rebuild')
  @ApiExcludeEndpoint()
  async rebuild(@Body('date') date: string, @Headers('x-admin-token') token?: string) {
    const adminToken = this.configService.get<string>('app.adminToken');
    if (!adminToken || token !== adminToken) {
      return { status: 'error', message: 'Unauthorized' };
    }

    this.logger.log(`Rebuild requested for ${date}.`);
    await this.ingestionService.rebuildDay(date);

    return { status: 'ok', date };
  }

  @Post('jobs/backfill')
  @ApiExcludeEndpoint()
  async backfill(
    @Body('from') from: string,
    @Body('to') to: string,
    @Headers('x-admin-token') token?: string,
  ) {
    const adminToken = this.configService.get<string>('app.adminToken');
    if (!adminToken || token !== adminToken) {
      return { status: 'error', message: 'Unauthorized' };
    }

    if (!from || !to) {
      return { status: 'error', message: 'from and to are required' };
    }

    const days = this.buildDateRange(from, to);
    this.logger.log(`Backfill requested from ${from} to ${to} (${days.length} days).`);
    for (const day of days) {
      this.logger.log(`Backfill ingesting ${day}.`);
      await this.ingestionService.ingestDay(day);
    }

    return { status: 'ok', from, to, days: days.length };
  }

  @Post('jobs/backfill-last-30')
  @ApiExcludeEndpoint()
  async backfillLast30(@Headers('x-admin-token') token?: string) {
    const adminToken = this.configService.get<string>('app.adminToken');
    if (!adminToken || token !== adminToken) {
      return { status: 'error', message: 'Unauthorized' };
    }

    const endDate = yesterdayInTimeZone('Europe/Warsaw');
    const end = parseDate(endDate);
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    const from = formatDate(start, 'UTC');
    const days = this.buildDateRange(from, endDate);
    this.logger.log(`Backfill last 30 days requested (${from} to ${endDate}).`);
    for (const day of days) {
      this.logger.log(`Backfill ingesting ${day}.`);
      await this.ingestionService.ingestDay(day);
    }

    return { status: 'ok', from, to: endDate, days: days.length };
  }

  @Post('jobs/backfill-10-minutes')
  @ApiExcludeEndpoint()
  async backfillTenMinutes(@Body('from') from?: string, @Headers('x-admin-token') token?: string) {
    const adminToken = this.configService.get<string>('app.adminToken');
    if (!adminToken || token !== adminToken) {
      return { status: 'error', message: 'Unauthorized' };
    }

    const start = from ? new Date(from) : new Date(Date.now() - 10 * 60 * 1000);
    if (Number.isNaN(start.getTime())) {
      return { status: 'error', message: 'Invalid from timestamp' };
    }

    const end = new Date(start.getTime() + 10 * 60 * 1000);
    this.logger.log(
      `Backfill 10-minute window requested (${start.toISOString()} to ${end.toISOString()}).`,
    );
    await this.ingestionService.ingestWindow(start, end);

    return { status: 'ok', from: start.toISOString(), to: end.toISOString() };
  }

  private sumStats(stats: Array<Awaited<ReturnType<StatsService['getLatestStats']>>[number]>) {
    return stats.reduce(
      (acc, stat) => {
        acc.totalTxCount += stat.totalTxCount;
        acc.swapsCount += stat.swapsCount;
        acc.swapsUsdValue = this.addDecimalStrings(acc.swapsUsdValue, stat.swapsUsdValue);
        acc.transfersCount += stat.transfersCount;
        acc.gasClaimsCount += stat.gasClaimsCount;
        acc.othersCount += stat.othersCount;
        acc.realUsageTotal += stat.realUsageTotal;
        acc.totalTransfers += stat.totalTransfers;
        acc.uniqueSenders += stat.uniqueSenders;
        acc.uniqueReceivers += stat.uniqueReceivers;
        acc.uniqueAddresses += stat.uniqueAddresses;
        acc.neoVolumeRaw += stat.neoVolumeRaw;
        acc.gasVolumeRaw += stat.gasVolumeRaw;
        acc.blockCount += stat.blockCount;

        return acc;
      },
      {
        date: stats[0]?.date ?? new Date(),
        totalTxCount: 0,
        swapsCount: 0,
        swapsUsdValue: '0',
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
      },
    );
  }

  private serializeStat(stat: {
    date: Date;
    totalTxCount: number;
    swapsCount: number;
    swapsUsdValue: string;
    transfersCount: number;
    gasClaimsCount: number;
    othersCount: number;
    realUsageTotal: number;
    totalTransfers: number;
    uniqueSenders: number;
    uniqueReceivers: number;
    uniqueAddresses: number;
    neoVolumeRaw: bigint;
    gasVolumeRaw: bigint;
    blockCount: number;
  }) {
    return {
      ...stat,
      neoVolumeRaw: stat.neoVolumeRaw.toString(),
      gasVolumeRaw: stat.gasVolumeRaw.toString(),
    };
  }

  private serializeAssetStat(stat: {
    asset: string;
    transferCount: number;
    txCount: number;
    uniqueSenders: number;
    uniqueReceivers: number;
    volumeRaw: bigint;
  }) {
    return {
      ...stat,
      volumeRaw: stat.volumeRaw.toString(),
    };
  }

  private serializeTopAddress(stat: { address: string; transferCount: number; volumeRaw: bigint }) {
    return {
      ...stat,
      volumeRaw: stat.volumeRaw.toString(),
    };
  }

  private parseLimit(limit: string | undefined, fallback: number): number {
    if (!limit) {
      return fallback;
    }

    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private addDecimalStrings(left: string, right: string): string {
    const leftDecimal = new Prisma.Decimal(left);
    const rightDecimal = new Prisma.Decimal(right);

    return leftDecimal.add(rightDecimal).toString();
  }

  private buildDateRange(from: string, to: string): string[] {
    const start = parseDate(from);
    const end = parseDate(to);
    if (start > end) {
      return [];
    }

    const days: string[] = [];
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86400000)
    ) {
      days.push(formatDate(cursor, 'UTC'));
    }

    return days;
  }
}
