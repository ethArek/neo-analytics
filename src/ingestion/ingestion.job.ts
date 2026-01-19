import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service';
import { yesterdayInTimeZone } from './date-utils';

const WARSAW_TIME_ZONE = 'Europe/Warsaw';

@Injectable()
export class IngestionJob {
  private readonly logger = new Logger(IngestionJob.name);
  private isRunning = false;
  private runningDate?: string;

  constructor(private readonly ingestionService: IngestionService) {}

  @Cron('10 1 * * *', { timeZone: WARSAW_TIME_ZONE })
  async handleCron(): Promise<void> {
    await this.runIfNeeded('scheduled');
  }

  @Cron('0 * * * *', { timeZone: WARSAW_TIME_ZONE })
  async handleHourlyRetry(): Promise<void> {
    await this.runIfNeeded('hourly-retry');
  }

  private async runIfNeeded(source: string): Promise<void> {
    const date = yesterdayInTimeZone(WARSAW_TIME_ZONE);
    if (this.isRunning) {
      this.logger.warn(
        `Ingestion already running for ${this.runningDate ?? date}. Skipping ${source} trigger.`
      );
      return;
    }

    const isComplete = await this.ingestionService.isDayIngested(date);
    if (isComplete) {
      if (source !== 'scheduled') {
        this.logger.debug(
          `Daily ingestion already completed for ${date}. Skipping ${source} trigger.`
        );
      }
      return;
    }

    this.isRunning = true;
    this.runningDate = date;

    try {
      if (source === 'scheduled') {
        this.logger.log(`Running daily ingestion for ${date}.`);
      } else {
        this.logger.warn(
          `Daily ingestion missing for ${date}. Starting ${source} retry.`
        );
      }
      await this.ingestionService.ingestDay(date);
    } finally {
      this.isRunning = false;
      this.runningDate = undefined;
    }
  }
}
