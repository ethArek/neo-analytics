import { ConfigService } from '@nestjs/config';
import { IngestionBusyError } from '../ingestion/ingestion.service';
import { ApiController } from './api.controller';

class StatsServiceStub {
  async getRangeOrLatest(_from?: string, _to?: string) {
    return {
      stats: [
        {
          date: new Date('2026-03-01T00:00:00.000Z'),
          totalTxCount: 10,
          swapsCount: 2,
          swapsUsdValue: '12.34000000',
          oracleCount: 1,
          transfersCount: 3,
          gasClaimsCount: 4,
          othersCount: 1,
          realUsageTotal: 6,
          totalTransfers: 5,
          uniqueSenders: 2,
          uniqueReceivers: 2,
          uniqueAddresses: 3,
          neoVolumeRaw: 100n,
          gasVolumeRaw: 200000000n,
          blockCount: 9,
        },
      ],
      range: {
        from: new Date('2026-03-01T00:00:00.000Z'),
        to: new Date('2026-03-01T00:00:00.000Z'),
      },
    };
  }

  async getUniqueAddressStatsRange(_from: string, _to: string) {
    return {
      uniqueSenders: 5,
      uniqueReceivers: 7,
      uniqueAddresses: 9,
    };
  }
}

class IngestionServiceStub {
  async ingestDay(_date: string): Promise<void> {}

  async rebuildDay(_date: string): Promise<void> {}

  async ingestWindow(_start: Date, _end: Date): Promise<void> {}

  async backfillSwapUsdValues(
    _from: string,
    _to?: string,
  ): Promise<{ days: number; transactions: number; to: string | null }> {
    return { days: 0, transactions: 0, to: null };
  }
}

class NeoXHistoryServiceStub {
  async syncRecentHistory(): Promise<{
    availableFrom: string | null;
    availableTo: string | null;
    persistedDays: number;
  }> {
    return {
      availableFrom: '2026-03-01',
      availableTo: '2026-04-10',
      persistedDays: 41,
    };
  }
}

describe('ApiController', () => {
  it('serializes transactions excluding GAS claims in summary totals', async () => {
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;

    const result = await controller.summary('2026-03-01', '2026-03-01');

    expect(result).toMatchObject({
      range: {
        from: '2026-03-01',
        to: '2026-03-01',
      },
      totals: {
        totalTxCount: 10,
        gasClaimsCount: 4,
        oracleCount: 1,
        transactionsExcludingGasClaims: 6,
        uniqueSenders: 5,
        uniqueReceivers: 7,
        uniqueAddresses: 9,
      },
    });
    expect(Object.prototype.hasOwnProperty.call(result.totals ?? {}, 'realUsageTotal')).toBe(false);
  });

  it('rejects swap usd backfill when unauthorized', async () => {
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;

    const result = await controller.backfillSwapUsd('2026-03-01', undefined, 'wrong');

    expect(result).toEqual({
      status: 'error',
      message: 'Unauthorized',
    });
  });

  it('backfills swap usd values when authorized', async () => {
    const ingestionService = new IngestionServiceStub();
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      ingestionService,
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;
    const backfillSpy = jest.spyOn(ingestionService, 'backfillSwapUsdValues').mockResolvedValue({
      days: 2,
      transactions: 3,
      to: '2026-03-02',
    });

    const result = await controller.backfillSwapUsd('2026-03-01', '2026-03-05', 'secret');

    expect(backfillSpy).toHaveBeenCalledWith('2026-03-01', '2026-03-05');
    expect(result).toEqual({
      status: 'ok',
      from: '2026-03-01',
      to: '2026-03-02',
      days: 2,
      transactions: 3,
    });
  });

  it('rejects manual ingestion when unauthorized', async () => {
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;

    const result = await controller.runJob('2026-03-01', 'wrong');

    expect(result).toEqual({
      status: 'error',
      message: 'Unauthorized',
    });
  });

  it('returns a busy error when a day lock is already held', async () => {
    const ingestionService = new IngestionServiceStub();
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      ingestionService,
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;
    jest
      .spyOn(ingestionService, 'ingestDay')
      .mockRejectedValue(new IngestionBusyError('2026-03-01'));

    const result = await controller.runJob('2026-03-01', 'secret');

    expect(result).toEqual({
      status: 'error',
      message: 'Ingestion already running for 2026-03-01.',
      date: '2026-03-01',
    });
  });

  it('syncs Neo X history when authorized', async () => {
    const neoXHistoryService = new NeoXHistoryServiceStub();
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
      neoXHistoryService,
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;
    const syncSpy = jest.spyOn(neoXHistoryService, 'syncRecentHistory').mockResolvedValue({
      availableFrom: '2026-03-01',
      availableTo: '2026-04-10',
      persistedDays: 41,
    });

    const result = await controller.syncNeoXHistory('secret');

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'ok',
      availableFrom: '2026-03-01',
      availableTo: '2026-04-10',
      persistedDays: 41,
    });
  });

  it('rejects Neo X history sync when unauthorized', async () => {
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
      new NeoXHistoryServiceStub(),
      new ConfigService({
        app: {
          adminToken: 'secret',
        },
      }),
    ]) as ApiController;

    const result = await controller.syncNeoXHistory('wrong');

    expect(result).toEqual({
      status: 'error',
      message: 'Unauthorized',
    });
  });
});
