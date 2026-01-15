import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import { PrismaService } from './common/prisma.service';
import { RpcNeoClient } from './neo-client/neo-client.service';
import { NEO_CLIENT } from './neo-client/neo-client.provider';
import { IngestionService } from './ingestion/ingestion.service';
import { IngestionJob } from './ingestion/ingestion.job';
import { StatsService } from './stats/stats.service';
import { WebController } from './web/web.controller';
import { ApiController } from './web/api.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [WebController, ApiController],
  providers: [
    PrismaService,
    IngestionService,
    IngestionJob,
    StatsService,
    {
      provide: NEO_CLIENT,
      useClass: RpcNeoClient,
    },
  ],
})
export class AppModule {}

