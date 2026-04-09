import { ConfigService } from '@nestjs/config';
import { TokenPerformanceService } from './token-performance.service';

describe('TokenPerformanceService', () => {
  const coinPaprikaApiUrl = 'https://api.coinpaprika.com/v1';
  const latestUrl = 'https://example.test/flamingo/live-data/prices/latest';
  const analyticsUrl = 'https://example.test/flamingo/analytics/rolling-30-days/total_data';
  const now = 1_800_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns top gainers and losers for the last 24h, 7 days, and 30 days', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );
    const latestRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 12 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 8 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.00001234,
      },
      { symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 1 },
    ];
    const last24hRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 10 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 10 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.00000845,
      },
      { symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 1 },
    ];
    const last7dRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 10 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 9 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.00000617,
      },
      {
        symbol: 'FUSD',
        unwrappedSymbol: 'FUSD',
        hash: '0xfusd',
        usd_price: 1.1,
      },
    ];
    const last30dRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 6 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 16 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.0000105,
      },
      {
        symbol: 'FUSD',
        unwrappedSymbol: 'FUSD',
        hash: '0xfusd',
        usd_price: 1.2,
      },
    ];
    const last24hTimestamp = now - 24 * 60 * 60 * 1000;
    const last7dTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    const last30dTimestamp = now - 30 * 24 * 60 * 60 * 1000;

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === latestUrl) {
        return new Response(JSON.stringify(latestRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last24hTimestamp}`) {
        return new Response(JSON.stringify(last24hRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last7dTimestamp}`) {
        return new Response(JSON.stringify(last7dRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last30dTimestamp}`) {
        return new Response(JSON.stringify(last30dRows), { status: 200 });
      }

      return new Response('[]', { status: 404 });
    });

    const result = await service.getDashboardTokenPerformance();

    expect(result.last24h.gainers.map((entry) => entry.symbol)).toEqual(['FLM']);
    expect(result.last24h.losers.map((entry) => entry.symbol)).toEqual(['GAS']);
    expect(result.last24h.gainers[0]?.changeLabel).toBe('+46.04%');
    expect(result.last24h.gainers[0]?.detail).toBe('$0.00001234');
    expect(result.last7d.gainers.map((entry) => entry.symbol)).toEqual(['FLM']);
    expect(result.last7d.losers.map((entry) => entry.symbol)).toEqual(['GAS']);
    expect(result.last7d.losers[0]?.changeLabel).toBe('-11.11%');
    expect(result.last30d.gainers.map((entry) => entry.symbol)).toEqual(['NEO']);
    expect(result.last30d.losers.map((entry) => entry.symbol)).toEqual(['GAS']);
    expect(result.last30d.gainers[0]?.changeLabel).toBe('+100.00%');
  });

  it('reuses cached Flamingo price snapshots across concurrent dashboard requests', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );
    const latestRows = [{ symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 12 }];
    const previousRows = [{ symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 10 }];
    const last24hTimestamp = now - 24 * 60 * 60 * 1000;
    const last7dTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    const last30dTimestamp = now - 30 * 24 * 60 * 60 * 1000;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === latestUrl) {
        return new Response(JSON.stringify(latestRows), { status: 200 });
      }

      if (
        url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last24hTimestamp}` ||
        url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last7dTimestamp}` ||
        url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last30dTimestamp}`
      ) {
        return new Response(JSON.stringify(previousRows), { status: 200 });
      }

      return new Response('[]', { status: 404 });
    });

    await Promise.all([
      service.getDashboardTokenPerformance(),
      service.getDashboardTokenPerformance(),
    ]);
    await service.getDashboardTokenPerformance();

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('returns cached Flamingo rolling dex volume rows using swap volume', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
          flamingoAnalyticsApiUrl: analyticsUrl,
        },
      }),
    );
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === analyticsUrl) {
        return new Response(
          JSON.stringify([
            {
              date: '2026-03-29T00:00:00',
              total_data: {
                total_order_volume: '1323.04',
                swap_volume: '1323.0355',
              },
            },
            {
              date: '2026-03-28T00:00:00',
              total_data: {
                total_order_volume: '36255.74',
                swap_volume: '29175.2921',
              },
            },
          ]),
          { status: 200 },
        );
      }

      return new Response('error', { status: 404 });
    });

    const first = await service.getRollingDexVolumeRows();
    const second = await service.getRollingDexVolumeRows();

    expect(first).toEqual([
      {
        date: '2026-03-28',
        swapVolume: 29175.2921,
        totalOrderVolume: 36255.74,
      },
      {
        date: '2026-03-29',
        swapVolume: 1323.0355,
        totalOrderVolume: 1323.04,
      },
    ]);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('filters token performance to assets that had swap activity in the matching window', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );
    const latestRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 12 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 8 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.00001234,
      },
    ];
    const last24hRows = [
      { symbol: 'NEO', unwrappedSymbol: 'NEO', hash: '0xneo', usd_price: 10 },
      { symbol: 'GAS', unwrappedSymbol: 'GAS', hash: '0xgas', usd_price: 10 },
      {
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        hash: '0xflm',
        usd_price: 0.00000845,
      },
    ];
    const last7dRows = last24hRows;
    const last30dRows = last24hRows;
    const last24hTimestamp = now - 24 * 60 * 60 * 1000;
    const last7dTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    const last30dTimestamp = now - 30 * 24 * 60 * 60 * 1000;

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === latestUrl) {
        return new Response(JSON.stringify(latestRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last24hTimestamp}`) {
        return new Response(JSON.stringify(last24hRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last7dTimestamp}`) {
        return new Response(JSON.stringify(last7dRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last30dTimestamp}`) {
        return new Response(JSON.stringify(last30dRows), { status: 200 });
      }

      return new Response('[]', { status: 404 });
    });

    const result = await service.getDashboardTokenPerformance({
      last24h: new Set(['0xneo', 'GAS']),
      last7d: new Set(['0xneo']),
      last30d: new Set([]),
    });

    expect(result.last24h.gainers.map((entry) => entry.symbol)).toEqual(['NEO']);
    expect(result.last24h.losers.map((entry) => entry.symbol)).toEqual(['GAS']);
    expect(result.last7d.gainers.map((entry) => entry.symbol)).toEqual(['NEO']);
    expect(result.last7d.losers.map((entry) => entry.symbol)).toEqual(['NEO']);
    expect(result.last30d.gainers).toEqual([]);
    expect(result.last30d.losers).toEqual([]);
  });

  it('returns asset market snapshot with current price and historical changes', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );
    const latestRows = [{ symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 1 }];
    const last24hRows = [
      { symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 0.95 },
    ];
    const last7dRows = [
      { symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 1.05 },
    ];
    const last30dRows = [
      { symbol: 'FUSD', unwrappedSymbol: 'FUSD', hash: '0xfusd', usd_price: 1.1 },
    ];
    const last24hTimestamp = now - 24 * 60 * 60 * 1000;
    const last7dTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    const last30dTimestamp = now - 30 * 24 * 60 * 60 * 1000;

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === latestUrl) {
        return new Response(JSON.stringify(latestRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last24hTimestamp}`) {
        return new Response(JSON.stringify(last24hRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last7dTimestamp}`) {
        return new Response(JSON.stringify(last7dRows), { status: 200 });
      }

      if (url === `${latestUrl.slice(0, -'/latest'.length)}/from-timestamp/${last30dTimestamp}`) {
        return new Response(JSON.stringify(last30dRows), { status: 200 });
      }

      return new Response('[]', { status: 404 });
    });

    const result = await service.getAssetMarketSnapshot('FUSD');

    expect(result).toEqual({
      symbol: 'FUSD',
      currentPrice: '$1.00',
      change24h: '+5.26%',
      change7d: '-4.76%',
      change30d: '-9.09%',
    });
  });

  it('reuses cached CoinPaprika market prices across concurrent requests', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${coinPaprikaApiUrl}/tickers/neo-neo?quotes=USD`) {
        return new Response(
          JSON.stringify({
            quotes: { USD: { price: 12.34, percent_change_24h: 14.85 } },
          }),
          {
            status: 200,
          },
        );
      }

      if (url === `${coinPaprikaApiUrl}/tickers/gas-gas?quotes=USD`) {
        return new Response(
          JSON.stringify({
            quotes: { USD: { price: 3.21, percent_change_24h: -1.1 } },
          }),
          {
            status: 200,
          },
        );
      }

      return new Response('error', { status: 404 });
    });

    await Promise.all([service.getMarketPrices(), service.getMarketPrices()]);
    await service.getMarketPrices();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns formatted NEO and GAS prices from the latest feed', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${coinPaprikaApiUrl}/tickers/neo-neo?quotes=USD`) {
        return new Response(
          JSON.stringify({
            quotes: { USD: { price: 12.34, percent_change_24h: 14.85 } },
          }),
          {
            status: 200,
          },
        );
      }

      if (url === `${coinPaprikaApiUrl}/tickers/gas-gas?quotes=USD`) {
        return new Response(
          JSON.stringify({
            quotes: { USD: { price: 3.21, percent_change_24h: -1.1 } },
          }),
          {
            status: 200,
          },
        );
      }

      return new Response('error', { status: 404 });
    });

    const result = await service.getMarketPrices();

    expect(result).toEqual({
      neo: {
        price: '$12.34',
        change24h: '+14.85%',
        tone: 'positive',
      },
      gas: {
        price: '$3.21',
        change24h: '-1.10%',
        tone: 'negative',
      },
    });
  });

  it('returns empty rankings when the price feed fails', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );

    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('error', { status: 500 }));

    const result = await service.getDashboardTokenPerformance();

    expect(result.last24h.gainers).toEqual([]);
    expect(result.last24h.losers).toEqual([]);
    expect(result.last7d.gainers).toEqual([]);
    expect(result.last7d.losers).toEqual([]);
    expect(result.last30d.gainers).toEqual([]);
    expect(result.last30d.losers).toEqual([]);
  });

  it('returns empty market prices when the latest feed fails', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );

    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('error', { status: 500 }));

    const result = await service.getMarketPrices();

    expect(result).toEqual({
      neo: {
        price: null,
        change24h: null,
        tone: 'neutral',
      },
      gas: {
        price: null,
        change24h: null,
        tone: 'neutral',
      },
    });
  });

  it('calls Coinpaprika ticker endpoints for NEO and GAS latest prices', async () => {
    const service = new TokenPerformanceService(
      new ConfigService({
        app: {
          coinPaprikaApiUrl,
          flamingoPriceApiUrl: latestUrl,
        },
      }),
    );

    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (
        url === `${coinPaprikaApiUrl}/tickers/neo-neo?quotes=USD` ||
        url === `${coinPaprikaApiUrl}/tickers/gas-gas?quotes=USD`
      ) {
        return new Response(JSON.stringify({ quotes: { USD: { price: 1 } } }), {
          status: 200,
        });
      }

      return new Response('error', { status: 404 });
    });

    await service.getMarketPrices();

    expect(fetchSpy).toHaveBeenCalledWith(`${coinPaprikaApiUrl}/tickers/neo-neo?quotes=USD`, {
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
      },
    });
    expect(fetchSpy).toHaveBeenCalledWith(`${coinPaprikaApiUrl}/tickers/gas-gas?quotes=USD`, {
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
      },
    });
  });
});
