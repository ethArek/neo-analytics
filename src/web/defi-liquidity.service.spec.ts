import { ConfigService } from '@nestjs/config';
import type { NeoClient } from '../neo-client/neo-client.interface';
import { DefiLiquidityService } from './defi-liquidity.service';
import type { FlamingoPriceRow } from './token-performance.service.types';

const poolDataUrl = 'https://example.test/flamingo/live-data/pool-data/latest';
const tvlUrl = 'https://example.test/flamingo/analytics/flamingo/usd-value-locked';

class NeoClientStub implements NeoClient {
  async fetchTransactionsForDay() {
    return { transactions: [] };
  }

  async resolveAssetDecimals(asset: string): Promise<number | null> {
    const decimalsByAsset = new Map<string, number>([
      ['0xfusd', 2],
      ['0xbneo', 2],
      ['0xgas', 2],
      ['0xfusdc', 2],
      ['0xbnb', 2],
      ['0xusdt', 2],
      ['0xwbtc', 2],
      ['0xcake', 2],
      ['0xflm', 2],
    ]);

    return decimalsByAsset.get(asset) ?? null;
  }
}

class TokenPerformanceServiceStub {
  latestPriceRowsCalls = 0;

  async getLatestPriceRows(): Promise<FlamingoPriceRow[]> {
    this.latestPriceRowsCalls += 1;

    return [
      {
        hash: '0xfusd',
        symbol: 'FUSD',
        unwrappedSymbol: 'FUSD',
        usdPrice: 0.98,
      },
      {
        hash: '0xbneo',
        symbol: 'bNEO',
        unwrappedSymbol: 'bNEO',
        usdPrice: 2,
      },
      {
        hash: '0xgas',
        symbol: 'GAS',
        unwrappedSymbol: 'GAS',
        usdPrice: 11,
      },
      {
        hash: '0xfusdc',
        symbol: 'USDC',
        unwrappedSymbol: 'USDC',
        usdPrice: 1,
      },
      {
        hash: '0xbnb',
        symbol: 'BNB',
        unwrappedSymbol: 'BNB',
        usdPrice: 4,
      },
      {
        hash: '0xusdt',
        symbol: 'USDT',
        unwrappedSymbol: 'USDT',
        usdPrice: 1,
      },
      {
        hash: '0xwbtc',
        symbol: 'WBTC',
        unwrappedSymbol: 'BTC',
        usdPrice: 25,
      },
      {
        hash: '0xcake',
        symbol: 'CAKE',
        unwrappedSymbol: 'CAKE',
        usdPrice: 2,
      },
      {
        hash: '0xflm',
        symbol: 'FLM',
        unwrappedSymbol: 'FLM',
        usdPrice: 0.5,
      },
    ];
  }
}

const createService = (
  neoClient: NeoClient = new NeoClientStub(),
  tokenPerformanceService: TokenPerformanceServiceStub = new TokenPerformanceServiceStub(),
) => {
  const configService = new ConfigService({
    app: {
      flamingoPoolDataApiUrl: poolDataUrl,
      flamingoTvlApiUrl: tvlUrl,
    },
  });

  return Reflect.construct(DefiLiquidityService, [
    neoClient,
    tokenPerformanceService,
    configService,
  ]) as DefiLiquidityService;
};

describe('DefiLiquidityService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a real liquidity snapshot from Flamingo pool balances', async () => {
    const service = createService();

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === poolDataUrl) {
        return new Response(
          JSON.stringify({
            data: {
              pool_data: {
                '0xpool-1': {
                  hash: '0xpool-1',
                  balances: {
                    '0xfusd': '10000',
                    '0xbneo': '1000',
                  },
                  total_usd_value: '120',
                },
                '0xpool-2': {
                  hash: '0xpool-2',
                  balances: {
                    '0xfusd': '5000',
                    '0xgas': '500',
                  },
                  total_usd_value: '102',
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url === tvlUrl) {
        return new Response(JSON.stringify('222'), { status: 200 });
      }

      return new Response('error', { status: 404 });
    });

    const result = await service.getTrackedLiquiditySnapshot();

    expect(result).toEqual({
      trackedTvlUsd: 222,
      stablecoinLiquidityUsd: 147,
      poolCount: 2,
      pricedAssets: 3,
      topAssets: [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          balance: 150,
          usdValue: 147,
          stablecoin: true,
        },
        {
          asset: '0xgas',
          symbol: 'GAS',
          balance: 5,
          usdValue: 55,
          stablecoin: false,
        },
        {
          asset: '0xbneo',
          symbol: 'BNEO',
          balance: 10,
          usdValue: 20,
          stablecoin: false,
        },
      ],
    });
  });

  it('keeps USDC in the Flamingo liquidity mix when the feed labels it differently', async () => {
    const service = createService();

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === poolDataUrl) {
        return new Response(
          JSON.stringify({
            data: {
              pool_data: {
                '0xpool-1': {
                  hash: '0xpool-1',
                  balances: {
                    '0xfusd': '10000',
                    '0xbneo': '1000',
                    '0xfusdc': '600',
                    '0xbnb': '300',
                  },
                  total_usd_value: '185',
                },
                '0xpool-2': {
                  hash: '0xpool-2',
                  balances: {
                    '0xfusd': '5000',
                    '0xgas': '500',
                    '0xusdt': '2500',
                    '0xwbtc': '100',
                    '0xcake': '500',
                    '0xflm': '1000',
                  },
                  total_usd_value: '120',
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url === tvlUrl) {
        return new Response(JSON.stringify('305'), { status: 200 });
      }

      return new Response('error', { status: 404 });
    });

    const result = await service.getTrackedLiquiditySnapshot();

    expect(result).toEqual({
      trackedTvlUsd: 305,
      stablecoinLiquidityUsd: 178,
      poolCount: 2,
      pricedAssets: 9,
      topAssets: [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          balance: 150,
          usdValue: 147,
          stablecoin: true,
        },
        {
          asset: '0xgas',
          symbol: 'GAS',
          balance: 5,
          usdValue: 55,
          stablecoin: false,
        },
        {
          asset: '0xusdt',
          symbol: 'USDT',
          balance: 25,
          usdValue: 25,
          stablecoin: true,
        },
        {
          asset: '0xwbtc',
          symbol: 'WBTC',
          balance: 1,
          usdValue: 25,
          stablecoin: false,
        },
        {
          asset: '0xbneo',
          symbol: 'BNEO',
          balance: 10,
          usdValue: 20,
          stablecoin: false,
        },
        {
          asset: '0xbnb',
          symbol: 'BNB',
          balance: 3,
          usdValue: 12,
          stablecoin: false,
        },
        {
          asset: '0xfusdc',
          symbol: 'USDC',
          balance: 6,
          usdValue: 6,
          stablecoin: true,
        },
      ],
    });
  });

  it('finds tracked liquidity details for an asset outside the top liquidity list', async () => {
    const service = createService();

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === poolDataUrl) {
        return new Response(
          JSON.stringify({
            data: {
              pool_data: {
                '0xpool-1': {
                  hash: '0xpool-1',
                  balances: {
                    '0xfusd': '10000',
                    '0xbneo': '1000',
                    '0xfusdc': '600',
                    '0xbnb': '300',
                  },
                  total_usd_value: '185',
                },
                '0xpool-2': {
                  hash: '0xpool-2',
                  balances: {
                    '0xfusd': '5000',
                    '0xgas': '500',
                    '0xusdt': '2500',
                    '0xwbtc': '100',
                    '0xcake': '500',
                    '0xflm': '1000',
                  },
                  total_usd_value: '120',
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url === tvlUrl) {
        return new Response(JSON.stringify('305'), { status: 200 });
      }

      return new Response('error', { status: 404 });
    });

    const result = await service.getTrackedLiquidityAsset('CAKE');

    expect(result).toEqual({
      asset: '0xcake',
      symbol: 'CAKE',
      balance: 5,
      usdValue: 10,
      stablecoin: false,
    });
  });

  it('falls back to summed pool TVL when the dedicated Flamingo TVL endpoint fails', async () => {
    const service = createService();

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === poolDataUrl) {
        return new Response(
          JSON.stringify({
            data: {
              pool_data: {
                '0xpool-1': {
                  hash: '0xpool-1',
                  balances: {
                    '0xfusd': '10000',
                  },
                  total_usd_value: '98',
                },
                '0xpool-2': {
                  hash: '0xpool-2',
                  balances: {
                    '0xusdt': '2500',
                  },
                  total_usd_value: '25',
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url === tvlUrl) {
        return new Response('error', { status: 500 });
      }

      return new Response('error', { status: 404 });
    });

    const result = await service.getTrackedLiquiditySnapshot();

    expect(result?.trackedTvlUsd).toBe(123);
    expect(result?.poolCount).toBe(2);
  });

  it('reuses cached liquidity snapshots across concurrent requests', async () => {
    const tokenPerformanceService = new TokenPerformanceServiceStub();
    const service = createService(new NeoClientStub(), tokenPerformanceService);
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === poolDataUrl) {
        return new Response(
          JSON.stringify({
            data: {
              pool_data: {
                '0xpool-1': {
                  hash: '0xpool-1',
                  balances: {
                    '0xfusd': '10000',
                  },
                  total_usd_value: '98',
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url === tvlUrl) {
        return new Response(JSON.stringify('98'), { status: 200 });
      }

      return new Response('error', { status: 404 });
    });

    const [first, second] = await Promise.all([
      service.getTrackedLiquiditySnapshot(),
      service.getTrackedLiquiditySnapshot(),
    ]);
    const third = await service.getTrackedLiquiditySnapshot();

    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(tokenPerformanceService.latestPriceRowsCalls).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('caches null snapshot when upstream returns no data and reuses it until TTL expiry', async () => {
    const tokenPerformanceService = new TokenPerformanceServiceStub();
    const service = createService(new NeoClientStub(), tokenPerformanceService);
    let callCount = 0;

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      callCount += 1;
      const url = input instanceof Request ? input.url : String(input);

      if (url === poolDataUrl) {
        return new Response(JSON.stringify({ data: { pool_data: {} } }), { status: 200 });
      }

      if (url === tvlUrl) {
        return new Response('error', { status: 500 });
      }

      return new Response('error', { status: 404 });
    });

    const first = await service.getTrackedLiquiditySnapshot();
    expect(first).toBeNull();
    expect(callCount).toBe(2);

    const second = await service.getTrackedLiquiditySnapshot();
    expect(second).toBeNull();

    const third = await service.getTrackedLiquiditySnapshot();
    expect(third).toBeNull();

    expect(callCount).toBe(2);
    expect(tokenPerformanceService.latestPriceRowsCalls).toBe(1);
  });
});
