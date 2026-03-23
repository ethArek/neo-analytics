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
        usdPrice: 1,
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
      trackedTvlUsd: 225,
      stablecoinLiquidityUsd: 150,
      trackedContracts: 4,
      pricedAssets: 3,
      topAssets: [
        {
          asset: '0xfusd',
          symbol: 'FUSD',
          balance: 150,
          usdValue: 150,
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
