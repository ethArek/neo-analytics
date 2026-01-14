import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { NeoClient, NeoPagedResponse } from './neo-client.interface';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class HttpNeoClient implements NeoClient {
  private readonly logger = new Logger(HttpNeoClient.name);
  private readonly baseUrl: string;
  private readonly rateLimitMs = 350;
  private readonly maxRetries = 4;

  constructor(private readonly httpService: HttpService, configService: ConfigService) {
    this.baseUrl = configService.get<string>('app.neoApiBaseUrl') ?? '';
  }

  async fetchTransactionsForDay(date: string, cursor?: string): Promise<NeoPagedResponse> {
    if (!this.baseUrl) {
      throw new Error('NEO_API_BASE_URL is not configured');
    }

    let attempt = 0;
    let lastError: Error | undefined;
    const url = `${this.baseUrl.replace(/\/$/, '')}/transactions`;

    while (attempt <= this.maxRetries) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<NeoPagedResponse>(url, {
            params: {
              date,
              cursor,
            },
          }),
        );
        await sleep(this.rateLimitMs);
        return response.data;
      } catch (error) {
        lastError = error as Error;
        const wait = Math.pow(2, attempt) * 250;
        this.logger.warn(`Fetch failed (attempt ${attempt + 1}). Retrying in ${wait}ms.`);
        await sleep(wait);
        attempt += 1;
      }
    }

    throw lastError ?? new Error('Failed to fetch transactions');
  }
}
