import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { classifyTransaction, defaultSwapMethods } from '../classifier/classifier';
import { NeoClient, NeoTransaction } from '../neo-client/neo-client.interface';
import { NEO_CLIENT } from '../neo-client/neo-client.provider';
import { parseDate } from './date-utils';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(NEO_CLIENT) private readonly neoClient: NeoClient,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async ingestDay(date: string): Promise<void> {
    const transactions = await this.fetchAllTransactionsForDay(date);
    const day = parseDate(date);

    await this.prisma.$transaction(async (tx) => {
      const data = transactions.map((transaction) => {
        const classification = classifyTransaction(transaction, {
          swapMethodAllowlist: defaultSwapMethods,
        });

        return {
          date: day,
          txid: transaction.txid,
          type: classification.type,
          from: classification.from,
          to: classification.to,
          timestamp: new Date(transaction.timestamp),
          rawJson: transaction.raw,
        };
      });

      if (data.length > 0) {
        await tx.dailyTx.createMany({ data, skipDuplicates: true });
      }

      const [swaps, transfers, gasClaims] = await Promise.all([
        tx.dailyTx.count({ where: { date: day, type: 'SWAP' } }),
        tx.dailyTx.count({ where: { date: day, type: 'NORMAL_TRANSFER' } }),
        tx.dailyTx.count({ where: { date: day, type: 'GAS_CLAIM' } }),
      ]);

      await tx.dailyStat.upsert({
        where: { date: day },
        update: {
          swapsCount: swaps,
          transfersCount: transfers,
          gasClaimsCount: gasClaims,
          realUsageTotal: swaps + transfers,
        },
        create: {
          date: day,
          swapsCount: swaps,
          transfersCount: transfers,
          gasClaimsCount: gasClaims,
          realUsageTotal: swaps + transfers,
        },
      });
    });

    const last = transactions[transactions.length - 1];
    if (last?.blockIndex) {
      await this.prisma.ingestionCursor.upsert({
        where: { network: this.configService.get('app.neoNetwork') },
        update: {
          lastProcessedBlock: last.blockIndex,
          lastProcessedTimestamp: new Date(last.timestamp),
        },
        create: {
          network: this.configService.get('app.neoNetwork'),
          lastProcessedBlock: last.blockIndex,
          lastProcessedTimestamp: new Date(last.timestamp),
        },
      });
    }

    this.logger.log(`Ingested ${transactions.length} transactions for ${date}.`);
  }

  async rebuildDay(date: string): Promise<void> {
    const day = parseDate(date);
    await this.prisma.dailyTx.deleteMany({ where: { date: day } });
    await this.prisma.dailyStat.deleteMany({ where: { date: day } });
    await this.ingestDay(date);
  }

  private async fetchAllTransactionsForDay(date: string): Promise<NeoTransaction[]> {
    const transactions: NeoTransaction[] = [];
    let cursor: string | undefined;
    let nextCursor: string | undefined;

    do {
      const response = await this.neoClient.fetchTransactionsForDay(date, cursor);
      transactions.push(...response.transactions);
      nextCursor = response.nextCursor;
      cursor = nextCursor;
    } while (nextCursor);

    return transactions;
  }
}
