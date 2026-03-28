import { TxType } from '@prisma/client';
import { StatsService } from './stats.service';

class DailyTxDelegateStub {
  async count() {
    return 0;
  }
}

class PrismaServiceStub {
  dailyTx = new DailyTxDelegateStub();
}

describe('StatsService', () => {
  it('reports missing swap usd coverage for a date range', async () => {
    const prisma = new PrismaServiceStub();
    const countSpy = jest
      .spyOn(prisma.dailyTx, 'count')
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    const service = Reflect.construct(StatsService, [prisma]);

    const result = await service.getSwapUsdCoverageRange('2026-03-01', '2026-03-07');

    expect(result).toEqual({
      swapCount: 5,
      pricedSwapCount: 3,
      missingSwapCount: 2,
    });
    expect(countSpy).toHaveBeenNthCalledWith(1, {
      where: {
        date: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-07T00:00:00.000Z'),
        },
        type: TxType.SWAP,
      },
    });
    expect(countSpy).toHaveBeenNthCalledWith(2, {
      where: {
        date: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-07T00:00:00.000Z'),
        },
        type: TxType.SWAP,
        swapUsdValue: { not: null },
      },
    });
  });
});
