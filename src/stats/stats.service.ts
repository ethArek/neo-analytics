import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { parseDate } from '../ingestion/date-utils';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestStats(limit = 30) {
    return this.prisma.dailyStat.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getStatsRange(from: string, to: string) {
    return this.prisma.dailyStat.findMany({
      where: {
        date: {
          gte: parseDate(from),
          lte: parseDate(to),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getDayDetails(date: string) {
    const day = parseDate(date);
    const [stat, transactions] = await Promise.all([
      this.prisma.dailyStat.findUnique({ where: { date: day } }),
      this.prisma.dailyTx.findMany({
        where: { date: day },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    return { stat, transactions };
  }
}
