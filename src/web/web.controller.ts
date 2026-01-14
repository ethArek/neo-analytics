import { Controller, Get, Param, Render } from '@nestjs/common';
import { StatsService } from '../stats/stats.service';
import { formatDate } from '../ingestion/date-utils';

@Controller()
export class WebController {
  constructor(private readonly statsService: StatsService) {}

  @Get('/')
  @Render('dashboard')
  async dashboard() {
    const stats = (await this.statsService.getLatestStats(30)).map((stat) => ({
      ...stat,
      dateLabel: formatDate(stat.date),
    }));
    const totals = stats.reduce(
      (acc, stat) => ({
        swaps: acc.swaps + stat.swapsCount,
        transfers: acc.transfers + stat.transfersCount,
        gasClaims: acc.gasClaims + stat.gasClaimsCount,
        realUsage: acc.realUsage + stat.realUsageTotal,
      }),
      { swaps: 0, transfers: 0, gasClaims: 0, realUsage: 0 },
    );

    return { stats, totals };
  }

  @Get('/day/:date')
  @Render('day')
  async day(@Param('date') date: string) {
    const { stat, transactions } = await this.statsService.getDayDetails(date);
    return {
      date,
      stat,
      transactions: transactions.map((tx) => ({
        ...tx,
        timestampLabel: new Date(tx.timestamp).toISOString(),
      })),
    };
  }
}
