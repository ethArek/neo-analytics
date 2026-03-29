import { DefiLiquidityService } from './defi-liquidity.service';
import type { NeoBalance, NeoClient } from '../neo-client/neo-client.interface';
import { defaultSwapContracts } from '../classifier/classifier';
import type { FlamingoPriceRow } from './token-performance.service.types';

class NeoClientStub implements NeoClient {
  readonly balanceRequests: string[] = [];

  async fetchTransactionsForDay() {
    return { transactions: [] };
  }

  async getAddressBalances(address: string): Promise<NeoBalance[]> {
    this.balanceRequests.push(address);

    if (address === 'NSy3Gffa2X45rzEP8x5wwLBbukEUVCg4KE') {
      return [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          assetName: 'Flamingo USD',
          balance: 100,
        },
        {
          asset: '0xbneo',
          symbol: 'bNEO',
          assetName: 'BurgerNEO',
          balance: 10,
        },
      ];
    }

    if (address === 'NenPXJNsJoVHT9XH78QVCMZiUmx7HetkXY') {
      return [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          assetName: 'Flamingo USD',
          balance: 50,
        },
        {
          asset: '0xgas',
          symbol: 'GAS',
          assetName: 'GasToken',
          balance: 5,
        },
      ];
    }

    return [];
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
    ];
  }
}

class NeoClientUsdcMixStub implements NeoClient {
  async fetchTransactionsForDay() {
    return { transactions: [] };
  }

  async getAddressBalances(address: string): Promise<NeoBalance[]> {
    if (address === 'NSy3Gffa2X45rzEP8x5wwLBbukEUVCg4KE') {
      return [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          assetName: 'Flamingo USD',
          balance: 100,
        },
        {
          asset: '0xbneo',
          symbol: 'bNEO',
          assetName: 'BurgerNEO',
          balance: 10,
        },
        {
          asset: '0xfusdc',
          symbol: 'fUSDC',
          assetName: 'Flamingo USD Coin',
          balance: 6,
        },
        {
          asset: '0xbnb',
          symbol: 'BNB',
          assetName: 'BNB',
          balance: 3,
        },
      ];
    }

    if (address === 'NenPXJNsJoVHT9XH78QVCMZiUmx7HetkXY') {
      return [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          assetName: 'Flamingo USD',
          balance: 50,
        },
        {
          asset: '0xgas',
          symbol: 'GAS',
          assetName: 'GasToken',
          balance: 5,
        },
        {
          asset: '0xusdt',
          symbol: 'USDT',
          assetName: 'Tether',
          balance: 25,
        },
        {
          asset: '0xwbtc',
          symbol: 'WBTC',
          assetName: 'Wrapped Bitcoin',
          balance: 1,
        },
        {
          asset: '0xcake',
          symbol: 'CAKE',
          assetName: 'PancakeSwap',
          balance: 5,
        },
        {
          asset: '0xflm',
          symbol: 'FLM',
          assetName: 'Flamingo',
          balance: 10,
        },
      ];
    }

    return [];
  }
}

class TokenPerformanceServiceUsdcMixStub {
  async getLatestPriceRows(): Promise<FlamingoPriceRow[]> {
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
        hash: '0xgas',
        symbol: 'GAS',
        unwrappedSymbol: 'GAS',
        usdPrice: 11,
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

describe('DefiLiquidityService', () => {
  it('builds a tracked liquidity snapshot from known swap contract balances', async () => {
    const neoClient = new NeoClientStub();
    const tokenPerformanceService = new TokenPerformanceServiceStub();
    const service = Reflect.construct(DefiLiquidityService, [
      neoClient,
      tokenPerformanceService,
    ]) as DefiLiquidityService;

    const result = await service.getTrackedLiquiditySnapshot();

    expect(result).toEqual({
      trackedTvlUsd: 222,
      stablecoinLiquidityUsd: 147,
      trackedContracts: 4,
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

  it('keeps USDC in the tracked liquidity mix when the feed labels it differently', async () => {
    const neoClient = new NeoClientUsdcMixStub();
    const tokenPerformanceService = new TokenPerformanceServiceUsdcMixStub();
    const service = Reflect.construct(DefiLiquidityService, [
      neoClient,
      tokenPerformanceService,
    ]) as DefiLiquidityService;

    const result = await service.getTrackedLiquiditySnapshot();

    expect(result).toEqual({
      trackedTvlUsd: 305,
      stablecoinLiquidityUsd: 178,
      trackedContracts: 4,
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

  it('reuses cached liquidity snapshots across concurrent requests', async () => {
    const neoClient = new NeoClientStub();
    const tokenPerformanceService = new TokenPerformanceServiceStub();
    const service = Reflect.construct(DefiLiquidityService, [
      neoClient,
      tokenPerformanceService,
    ]) as DefiLiquidityService;

    const [first, second] = await Promise.all([
      service.getTrackedLiquiditySnapshot(),
      service.getTrackedLiquiditySnapshot(),
    ]);
    const third = await service.getTrackedLiquiditySnapshot();

    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(tokenPerformanceService.latestPriceRowsCalls).toBe(1);
    expect(neoClient.balanceRequests).toHaveLength(defaultSwapContracts.length);
  });
});
