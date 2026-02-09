import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('throws when database URL is missing', () => {
    const config = new ConfigService({
      app: {},
    });

    expect(() => new PrismaService(config)).toThrow(
      'Database URL is not configured (app.databaseUrl)',
    );
  });

  it('connects and disconnects on module lifecycle hooks', async () => {
    const config = new ConfigService({
      app: {
        databaseUrl: 'postgresql://user:pass@localhost:5432/neo_usage',
      },
    });
    const service = new PrismaService(config);
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();
    const pool = Reflect.get(service, 'pool') as { end: () => Promise<void> };
    const poolEndSpy = jest.spyOn(pool, 'end').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(poolEndSpy).toHaveBeenCalledTimes(1);
  });
});
