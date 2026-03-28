import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initDefiCharts } from '../../charts/defi';
import { ThemeProvider } from '../theme';
import type { DefiChartData, DefiData } from '../types';
import { DefiPage } from './DefiPage';

jest.mock('../../charts/defi', () => ({
  initDefiCharts: jest.fn(),
}));

describe('DefiPage', () => {
  const chartData: DefiChartData = {
    labels: ['2026-03-07', '2026-03-08'],
    series: {
      swapUsdValue: [1200.5, 980.25],
      swaps: [14, 9],
    },
  };

  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders blockchain-first DeFi metrics and initializes charts', async () => {
    const data: DefiData = {
      marketPrices: {
        neo: {
          price: '$12.34',
          change24h: '+2.40%',
          tone: 'positive',
        },
        gas: {
          price: '$3.21',
          change24h: '-1.10%',
          tone: 'negative',
        },
      },
      nav: {
        defi: true,
      },
      rangeLabel: '2026-03-01 to 2026-03-10',
      rangeFrom: '2026-03-01',
      rangeTo: '2026-03-10',
      tokenPerformance: {
        last24h: {
          label: 'Last 24h',
          gainers: [
            {
              symbol: 'NUDES',
              detail: '$0.00001234',
              changeLabel: '+12.50%',
              tone: 'positive',
            },
          ],
          losers: [
            {
              symbol: 'GAS',
              detail: '$3.50',
              changeLabel: '-4.20%',
              tone: 'negative',
            },
          ],
        },
        last7d: {
          label: 'Last 7 days',
          gainers: [
            {
              symbol: 'NEO',
              detail: '$20.00',
              changeLabel: '+18.00%',
              tone: 'positive',
            },
          ],
          losers: [
            {
              symbol: 'FUSD',
              detail: '$1.00',
              changeLabel: '-1.10%',
              tone: 'negative',
            },
          ],
        },
        last30d: {
          label: 'Last 30 days',
          gainers: [
            {
              symbol: 'bNEO',
              detail: '$22.00',
              changeLabel: '+33.00%',
              tone: 'positive',
            },
          ],
          losers: [
            {
              symbol: 'WBTC',
              detail: '$65,000.00',
              changeLabel: '-12.00%',
              tone: 'negative',
            },
          ],
        },
      },
      totals: {
        estimatedSwapUsdValue: '$2,180.75',
        swaps: '23',
        averageSwapUsdValue: '$94.82',
        coveredDays: '4',
        requestedDays: '10',
        activityShare: '21.30%',
        activeSwapWallets: '17',
      },
      onChainOverview: {
        latestDayDexVolume: '$980.25',
        latestDayLabel: '2026-03-08',
        last7dDexVolume: '$6,420.55',
        last7dLabel: '2026-03-02 to 2026-03-08',
        recentVolumeNotice:
          'Recent DEX volume may be incomplete because latest ingested day is 2026-03-08, so newer days are not included yet, and 5 swap transactions in the displayed recent window are still missing USD pricing, including 2 swaps on 2026-03-08.',
        trackedTvl: '$719,999.31',
        stablecoinLiquidity: '$306,986.22',
        stablecoinShare: '42.64%',
        trackedContracts: '4',
        pricedAssets: '10',
        topLiquidityAssets: [
          {
            symbol: 'FUSD',
            balanceLabel: '293,276.14',
            usdValueLabel: '$272,479.53',
            stablecoin: true,
          },
        ],
      },
      topSwapAssets: [
        {
          assetLabel: 'FUSD',
          swaps: '9',
          usdVolume: '$1,200.50',
          averageSwapUsdValue: '$133.39',
        },
      ],
      largestSwaps: [
        {
          txid: '0xabc123',
          shortTxid: '0xabc1...c123',
          timestampLabel: '2026-03-08 12:30 UTC',
          dayLabel: '2026-03-08',
          dayHref: '/day/2026-03-08',
          assetLabel: 'FUSD',
          amountLabel: '1,000.00',
          usdValueLabel: '$1,000.00',
          method: 'swapTokens',
        },
      ],
      recentSwaps: [
        {
          txid: '0xdef456',
          shortTxid: '0xdef4...f456',
          timestampLabel: '2026-03-08 13:10 UTC',
          dayLabel: '2026-03-08',
          dayHref: '/day/2026-03-08',
          assetLabel: 'GAS',
          amountLabel: '15.50',
          usdValueLabel: '$250.00',
          method: 'swap',
        },
      ],
      chartData,
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <DefiPage />
      </ThemeProvider>,
    );

    const mockedInit = jest.mocked(initDefiCharts);
    await waitFor(() => {
      expect(mockedInit).toHaveBeenCalledWith(chartData, 'dark');
    });

    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
    expect(screen.getByText('2026-03-01 to 2026-03-10')).toBeInTheDocument();
    expect(screen.getByText('DEX volume')).toBeInTheDocument();
    expect(screen.getByText('$2,180.75')).toBeInTheDocument();
    expect(screen.getByText('Active swap wallets')).toBeInTheDocument();
    expect(screen.getByText('21.30%')).toBeInTheDocument();
    expect(screen.getByText('Yesterday DEX volume')).toBeInTheDocument();
    expect(screen.getByText('Tracked DEX TVL')).toBeInTheDocument();
    expect(screen.getByText('$719,999.31')).toBeInTheDocument();
    expect(screen.getByText('Stablecoin liquidity')).toBeInTheDocument();
    expect(screen.getByText('$306,986.22')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Recent DEX volume may be incomplete because latest ingested day is 2026-03-08, so newer days are not included yet, and 5 swap transactions in the displayed recent window are still missing USD pricing, including 2 swaps on 2026-03-08.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Tracked liquidity mix')).toBeInTheDocument();
    expect(screen.getByText('Top swap assets')).toBeInTheDocument();
    expect(screen.getByText('Largest swaps')).toBeInTheDocument();
    expect(screen.getByText('Recent swaps')).toBeInTheDocument();
    expect(screen.getByText('0xabc1...c123')).toBeInTheDocument();
    expect(screen.getByText('0xdef4...f456')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated swap USD value' })).toBeInTheDocument();
    expect(screen.getByText('Top gainer · Last 24h')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));

    expect(screen.getByText('Top gainer · Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '30 days' }));

    expect(screen.getByText('Top gainer · Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('bNEO')).toBeInTheDocument();
    expect(screen.getByText('-12.00%')).toBeInTheDocument();
  });
});
