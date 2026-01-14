import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service';
import { yesterdayInTimeZone } from './date-utils';

@Injectable()
export class IngestionJob {
  private readonly logger = new Logger(IngestionJob.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Cron('10 1 * * *', { timeZone: 'Europe/Warsaw' })
  async handleCron(): Promise<void> {
    const date = yesterdayInTimeZone('Europe/Warsaw');
    this.logger.log(`Running daily ingestion for ${date}.`);
    await this.ingestionService.ingestDay(date);
  }
}
