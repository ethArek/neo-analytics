import { ConfigService } from '@nestjs/config';
import { ApiController } from './api.controller';

class StatsServiceStub {}

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

describe('ApiController', () => {
  it('rejects swap usd backfill when unauthorized', async () => {
    const controller = Reflect.construct(ApiController, [
      new StatsServiceStub(),
      new IngestionServiceStub(),
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
});
