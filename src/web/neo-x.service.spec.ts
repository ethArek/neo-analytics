import { ConfigService } from '@nestjs/config';
import { NeoXService } from './neo-x.service';

describe('NeoXService', () => {
  const apiUrl = 'https://xexplorer.example/api/v2';
  const createConfigService = () =>
    new ConfigService({
      app: {
        neoXExplorerApiUrl: apiUrl,
      },
    });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes Neo X explorer stats and transaction chart rows', async () => {
    const service = new NeoXService(createConfigService());

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${apiUrl}/stats`) {
        return new Response(
          JSON.stringify({
            average_block_time: 8747,
            gas_prices: {
              average: 39.21,
            },
            gas_used_today: '59289564',
            total_addresses: '17512',
            total_blocks: '6161602',
            total_transactions: '153583',
            transactions_today: '406',
          }),
          { status: 200 },
        );
      }

      if (url === `${apiUrl}/stats/charts/transactions`) {
        return new Response(
          JSON.stringify({
            chart_data: [
              {
                date: '2026-04-08',
                tx_count: 406,
              },
              {
                date: '2026-04-06',
                tx_count: 311,
              },
              {
                date: '2026-04-07',
                tx_count: 503,
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response('not-found', { status: 404 });
    });

    const [stats, chart] = await Promise.all([
      service.getNetworkStats(),
      service.getTransactionChart(),
    ]);

    expect(stats).toEqual({
      averageBlockTimeMs: 8747,
      averageGasPriceGwei: 39.21,
      gasUsedToday: '59289564',
      totalAddresses: 17512,
      totalBlocks: 6161602,
      totalTransactions: 153583,
      transactionsToday: 406,
    });
    expect(chart).toEqual([
      {
        date: '2026-04-06',
        txCount: 311,
      },
      {
        date: '2026-04-07',
        txCount: 503,
      },
      {
        date: '2026-04-08',
        txCount: 406,
      },
    ]);
  });

  it('reuses cached Neo X stats across concurrent requests', async () => {
    const service = new NeoXService(createConfigService());
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${apiUrl}/stats`) {
        return new Response(
          JSON.stringify({
            average_block_time: 9000,
            gas_prices: {
              average: 40,
            },
            gas_used_today: '100',
            total_addresses: '200',
            total_blocks: '300',
            total_transactions: '400',
            transactions_today: '50',
          }),
          { status: 200 },
        );
      }

      return new Response('not-found', { status: 404 });
    });

    const [first, second] = await Promise.all([
      service.getNetworkStats(),
      service.getNetworkStats(),
    ]);
    const third = await service.getNetworkStats();

    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not cache Neo X fallback responses after explorer errors', async () => {
    const service = new NeoXService(createConfigService());
    const fetchSpy = jest.spyOn(global, 'fetch');

    fetchSpy.mockResolvedValueOnce(new Response('upstream-error', { status: 500 }));
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          average_block_time: 8747,
          gas_prices: {
            average: 39.21,
          },
          gas_used_today: '59289564',
          total_addresses: '17512',
          total_blocks: '6161602',
          total_transactions: '153583',
          transactions_today: '406',
        }),
        { status: 200 },
      ),
    );

    const first = await service.getNetworkStats();
    const second = await service.getNetworkStats();

    expect(first).toBeNull();
    expect(second).toEqual({
      averageBlockTimeMs: 8747,
      averageGasPriceGwei: 39.21,
      gasUsedToday: '59289564',
      totalAddresses: 17512,
      totalBlocks: 6161602,
      totalTransactions: 153583,
      transactionsToday: 406,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      `${apiUrl}/stats`,
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        }),
      }),
    );
  });

  it('limits Neo X recent transactions to eight by default', async () => {
    const service = new NeoXService(createConfigService());

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${apiUrl}/main-page/transactions`) {
        return new Response(
          JSON.stringify(
            Array.from({ length: 10 }, (_, index) => ({
              hash: `0x${index.toString(16).padStart(2, '0')}`,
              timestamp: `2026-04-09T17:${String(index).padStart(2, '0')}:00.000000Z`,
              status: 'ok',
              tx_types: ['contract_call'],
            })),
          ),
          { status: 200 },
        );
      }

      return new Response('not-found', { status: 404 });
    });

    const transactions = await service.getRecentTransactions();

    expect(transactions).toHaveLength(8);
    expect(transactions.map((transaction) => transaction.hash)).toEqual([
      '0x00',
      '0x01',
      '0x02',
      '0x03',
      '0x04',
      '0x05',
      '0x06',
      '0x07',
    ]);
  });

  it('normalizes recent transactions and excludes LP tokens from ERC-20 rankings', async () => {
    const service = new NeoXService(createConfigService());

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${apiUrl}/main-page/transactions`) {
        return new Response(
          JSON.stringify([
            {
              hash: '0xabc123',
              timestamp: '2026-04-09T17:11:50.000000Z',
              status: 'ok',
              method: 'swapExactTokens',
              fee: {
                value: '4767680000000000',
              },
              gas_used: '119192',
              value: '0',
              tx_types: ['contract_call'],
              from: {
                hash: '0xfrom',
                name: null,
                is_contract: false,
                is_verified: false,
              },
              to: {
                hash: '0xto',
                name: 'CommitStore',
                is_contract: true,
                is_verified: true,
              },
            },
          ]),
          { status: 200 },
        );
      }

      if (url === `${apiUrl}/tokens?type=ERC-20`) {
        return new Response(
          JSON.stringify({
            items: [
              {
                address: '0xlp-token',
                symbol: 'xBNB-WGAS10',
                name: 'LP Token',
                holders: '120',
                total_supply: '1000000000000000000',
                decimals: '18',
                type: 'ERC-20',
              },
              {
                address: '0xtoken',
                symbol: 'xBNB',
                name: 'NeoX BNB',
                holders: '950',
                total_supply: '9926871365195354389',
                decimals: '18',
                type: 'ERC-20',
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response('not-found', { status: 404 });
    });

    const [transactions, tokens] = await Promise.all([
      service.getRecentTransactions(6),
      service.getTopTokens(1),
    ]);

    expect(transactions).toEqual([
      {
        hash: '0xabc123',
        timestamp: '2026-04-09T17:11:50.000000Z',
        status: 'ok',
        method: 'swapExactTokens',
        from: {
          hash: '0xfrom',
          name: null,
          isContract: false,
          isVerified: false,
        },
        to: {
          hash: '0xto',
          name: 'CommitStore',
          isContract: true,
          isVerified: true,
        },
        feeWei: '4767680000000000',
        gasUsed: '119192',
        valueWei: '0',
        txTypes: ['contract_call'],
      },
    ]);
    expect(tokens).toEqual([
      {
        address: '0xtoken',
        symbol: 'xBNB',
        name: 'NeoX BNB',
        holders: 950,
        totalSupply: '9926871365195354389',
        decimals: 18,
        type: 'ERC-20',
      },
    ]);
  });
});
