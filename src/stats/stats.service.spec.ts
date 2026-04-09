import { Prisma, TxType } from '@prisma/client';
import { StatsService } from './stats.service';

class DailyTxDelegateStub {
  async count() {
    return 0;
  }
}

class PrismaServiceStub {
  dailyTx = new DailyTxDelegateStub();
  $queryRaw = jest.fn();
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

  it('returns asset transaction type breakdown ordered by count', async () => {
    const prisma = new PrismaServiceStub();
    prisma.$queryRaw.mockResolvedValue([
      {
        type: TxType.NORMAL_TRANSFER,
        txCount: 4n,
      },
      {
        type: TxType.SWAP,
        txCount: 7n,
      },
    ]);
    const service = Reflect.construct(StatsService, [prisma]);

    const result = await service.getAssetTransactionTypeBreakdownRange(
      '0xfusd',
      '2026-03-01',
      '2026-03-07',
    );

    expect(result).toEqual([
      {
        type: TxType.SWAP,
        txCount: 7,
      },
      {
        type: TxType.NORMAL_TRANSFER,
        txCount: 4,
      },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('maps recent asset transactions with bigint amounts', async () => {
    const prisma = new PrismaServiceStub();
    prisma.$queryRaw.mockResolvedValue([
      {
        date: new Date('2026-03-07T00:00:00.000Z'),
        txid: '0xassettx',
        type: TxType.SWAP,
        timestamp: new Date('2026-03-07T12:30:00.000Z'),
        amountRaw: new Prisma.Decimal('123450000'),
        transferCount: 2n,
        method: 'swapTokens',
      },
    ]);
    const service = Reflect.construct(StatsService, [prisma]);

    const result = await service.getRecentAssetTransactionsRange(
      '0xfusd',
      '2026-03-01',
      '2026-03-07',
      5,
    );

    expect(result).toEqual([
      {
        date: new Date('2026-03-07T00:00:00.000Z'),
        txid: '0xassettx',
        type: TxType.SWAP,
        timestamp: new Date('2026-03-07T12:30:00.000Z'),
        amountRaw: 123450000n,
        transferCount: 2,
        method: 'swapTokens',
      },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
