import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NeoXHistoryService } from './neo-x-history.service';

const UTC_TIME_ZONE = 'UTC';

@Injectable()
export class NeoXHistoryJob {
  private readonly logger = new Logger(NeoXHistoryJob.name);
  private isRunning = false;

  constructor(
    @Inject(NeoXHistoryService)
    private readonly neoXHistoryService: NeoXHistoryService,
  ) {}

  @Cron('15 * * * *', { timeZone: UTC_TIME_ZONE })
  async handleHourlySync(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Neo X history sync is already running. Skipping hourly trigger.');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.neoXHistoryService.syncRecentHistory();
      this.logger.log(
        `Synced Neo X history (${result.persistedDays} persisted days, available ${result.availableFrom ?? '-'} to ${result.availableTo ?? '-'}).`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
