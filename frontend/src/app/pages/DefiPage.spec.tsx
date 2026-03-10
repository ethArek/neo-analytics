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

  it('renders DeFi metrics and initializes charts', async () => {
    const data: DefiData = {
      nav: {
        defi: true,
      },
      availabilityFrom: '2026-03-07',
      requestedFrom: '2026-03-01',
      requestedTo: '2026-03-10',
      effectiveFrom: '2026-03-07',
      effectiveTo: '2026-03-10',
      requestedRangeLabel: '2026-03-01 to 2026-03-10',
      effectiveRangeLabel: '2026-03-07 to 2026-03-10',
      coverageNote: 'Requested 10 days. Using the DeFi window from 2026-03-07 onward.',
      banner: {
        tone: 'warning',
        statusLabel: 'Partial coverage',
        title: 'The selected range was clamped to the DeFi launch date.',
        body: 'Metrics start on 2026-03-07 for this deployment, so the earlier days are excluded.',
      },
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
      },
      chartData,
      dailyStats: [
        {
          dateLabel: '2026-03-07',
          swapsLabel: '14',
          swapUsdValue: '$1,200.50',
        },
      ],
      methodology: [
        'DeFi metrics begin on 2026-03-07 for this deployment.',
        'Estimated swap USD value sums priced transfer legs.',
      ],
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

    expect(screen.getByRole('heading', { name: 'Estimated swap USD value' })).toBeInTheDocument();
    expect(screen.getByText('$2,180.75')).toBeInTheDocument();
    expect(screen.getByText('Top gainer · Last 24h')).toBeInTheDocument();
    expect(screen.getByText('Top loser · Last 24h')).toBeInTheDocument();
    expect(screen.getByText('NUDES')).toBeInTheDocument();
    expect(screen.getByText('$0.00001234')).toBeInTheDocument();
    expect(screen.getByText('-4.20%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));

    expect(screen.getByText('Top gainer · Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('NEO')).toBeInTheDocument();
    expect(screen.getByText('-1.10%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '30 days' }));

    expect(screen.getByText('Top gainer · Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('bNEO')).toBeInTheDocument();
    expect(screen.getByText('-12.00%')).toBeInTheDocument();
  });
});
