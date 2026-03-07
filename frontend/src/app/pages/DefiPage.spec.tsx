import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DefiPage } from './DefiPage';
import { initDefiCharts } from '../../charts/defi';
import type { DefiChartData, DefiData } from '../types';

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

    render(<DefiPage />);

    const mockedInit = jest.mocked(initDefiCharts);
    await waitFor(() => {
      expect(mockedInit).toHaveBeenCalledWith(chartData);
    });

    expect(screen.getByText('DeFi metrics')).toBeInTheDocument();
    expect(
      screen.getByText('Estimated swap USD metrics with a clear historical boundary.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Partial coverage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated swap USD value' })).toBeInTheDocument();
    expect(screen.getByText('$2,180.75')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2026-03-07' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Core dashboard' })).toHaveAttribute(
      'href',
      '/dashboard?from=2026-03-07&to=2026-03-10',
    );
    expect(screen.getByRole('link', { name: 'Daily table' })).toHaveAttribute(
      'href',
      '/days?from=2026-03-07&to=2026-03-10',
    );
    expect(screen.getByText('How to read this page')).toBeInTheDocument();
  });
});
