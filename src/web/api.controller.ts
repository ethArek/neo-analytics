import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from '../ingestion/ingestion.service';
import { StatsService } from '../stats/stats.service';
import { yesterdayInTimeZone } from '../ingestion/date-utils';

@Controller('api')
export class ApiController {
  constructor(
    private readonly statsService: StatsService,
    private readonly ingestionService: IngestionService,
    private readonly configService: ConfigService,
  ) {}

  @Get('stats')
  async stats(@Query('from') from?: string, @Query('to') to?: string) {
    if (from && to) {
      return this.statsService.getStatsRange(from, to);
    }
    return this.statsService.getLatestStats();
  }

  @Post('jobs/run')
  async runJob(@Body('date') date?: string) {
    const target = date ?? yesterdayInTimeZone('Europe/Warsaw');
    await this.ingestionService.ingestDay(target);
    return { status: 'ok', date: target };
  }

  @Post('jobs/rebuild')
  async rebuild(@Body('date') date: string, @Headers('x-admin-token') token?: string) {
    const adminToken = this.configService.get<string>('app.adminToken');
    if (!adminToken || token !== adminToken) {
      return { status: 'error', message: 'Unauthorized' };
    }
    await this.ingestionService.rebuildDay(date);
    return { status: 'ok', date };
  }
}
