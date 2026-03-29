import { render, screen, waitFor } from '@testing-library/react';
import { initDashboardCharts } from '../../charts/dashboard';
import { ThemeProvider } from '../theme';
import type { DashboardChartData, DashboardData } from '../types';
import { DashboardPage } from './DashboardPage';

jest.mock('../../charts/dashboard', () => ({
  initDashboardCharts: jest.fn(),
}));

describe('DashboardPage', () => {
  const chartData: DashboardChartData = {
    labels: ['2024-01-01'],
    series: {
      swaps: [1],
      oracle: [2],
      transfers: [2],
      gasClaims: [3],
      others: [4],
      transactionsExcludingGasClaims: [5],
      totalTxs: [6],
      activeAddresses: [7],
      neoVolume: [8],
      gasVolume: [9],
    },
    assets: {
      labels: ['NEO'],
      values: [10],
    },
  };

  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes charts and renders the dashboard lists', async () => {
    const data: DashboardData = {
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
      totals: {
        totalTxs: '100',
        transactionsExcludingGasClaims: '80',
        oracle: '5',
        others: '7',
        activeAddresses: '50',
        neoVolume: '200',
        gasVolume: '300',
        blocks: '400',
      },
      chartData,
      rangeLabel: '2024-01-01 to 2024-01-01',
      rangeFrom: '2024-01-01',
      rangeTo: '2024-01-01',
      topSenders: [
        {
          address: 'sender-1',
          shortAddress: 'NSy3Gf...g4KE',
          addressLabel: 'Binance Hot wallet',
          transferCount: '10',
        },
      ],
      topReceivers: [
        {
          address: 'receiver-1',
          shortAddress: 'NUqLhf...ouVp',
          addressLabel: 'Gate.io',
          transferCount: '12',
        },
      ],
      assetBreakdown: [
        {
          assetLabel: 'NEO',
          transferCount: '33',
          volumeLabel: '1234',
        },
      ],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>,
    );

    const mockedInit = jest.mocked(initDashboardCharts);
    await waitFor(() => {
      expect(mockedInit).toHaveBeenCalledWith(chartData, 'dark');
    });

    expect(screen.getByText('Top senders')).toBeInTheDocument();
    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
    expect(screen.getByText('Oracle transactions (subset)')).toBeInTheDocument();
    expect(screen.getByText('Included in transactions excluding GAS claims')).toBeInTheDocument();
    expect(screen.queryByText('Others')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocks scanned')).not.toBeInTheDocument();
    expect(screen.getByText('NSy3Gf...g4KE (Binance Hot wallet)')).toBeInTheDocument();
    expect(screen.getByText('sender-1')).toBeInTheDocument();
    expect(screen.getByText('Top receivers')).toBeInTheDocument();
    expect(screen.getByText('NUqLhf...ouVp (Gate.io)')).toBeInTheDocument();
    expect(screen.getByText('receiver-1')).toBeInTheDocument();
    expect(screen.getByText('Asset transfer volume')).toBeInTheDocument();
    expect(screen.getByText('33 transfers')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daily table' })).toHaveAttribute(
      'href',
      '/days?from=2024-01-01&to=2024-01-01',
    );
  });
});
