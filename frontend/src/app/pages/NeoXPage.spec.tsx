import { render, screen, waitFor } from '@testing-library/react';
import { initNeoXCharts } from '../../charts/neo-x';
import { ThemeProvider } from '../theme';
import type { NeoXChartData, NeoXData } from '../types';
import { NeoXPage } from './NeoXPage';

jest.mock('../../charts/neo-x', () => ({
  initNeoXCharts: jest.fn(),
}));

describe('NeoXPage', () => {
  const chartData: NeoXChartData = {
    labels: ['2026-04-01', '2026-04-02'],
    series: {
      transactions: [120, 180],
      rollingAverage: [120, 150],
      cumulativeTransactions: [120, 300],
    },
  };

  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes charts and renders Neo X snapshot sections', async () => {
    const data: NeoXData = {
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
        neoX: true,
      },
      status: 'ready',
      rangeLabel: '2026-04-01 to 2026-04-02',
      rangeFrom: '2026-04-01',
      rangeTo: '2026-04-02',
      availableRangeLabel: '2026-03-10 to 2026-04-08',
      summaryCards: [
        {
          label: 'Transactions in range',
          value: '300',
          detail: '2 days covered',
          accent: true,
        },
        {
          label: 'Average gas price',
          value: '39.21 Gwei',
          detail: 'Explorer-reported average',
        },
      ],
      chartData,
      recentTransactions: [
        {
          hash: '0xabc123',
          shortHash: '0xabc1...c123',
          timestampLabel: '2026-04-09 17:11:50 UTC',
          methodLabel: 'transmit',
          statusLabel: 'Success',
          fromLabel: '0xfrom...from',
          fromMeta: '0xfrom',
          fromHref: 'https://xexplorer.neo.org/address/0xfrom',
          toLabel: 'CommitStore',
          toMeta: '0xto',
          toHref: 'https://xexplorer.neo.org/address/0xto',
          feeLabel: '0.004767',
          typeLabel: 'Contract Call',
        },
      ],
      topTokens: [
        {
          address: '0xtoken',
          shortAddress: '0xtoke...oken',
          symbol: 'xBNB',
          name: 'NeoX BNB',
          holdersLabel: '950',
          totalSupplyLabel: '9.9268',
          typeLabel: 'ERC-20',
        },
      ],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <NeoXPage />
      </ThemeProvider>,
    );

    const mockedInit = jest.mocked(initNeoXCharts);
    await waitFor(() => {
      expect(mockedInit).toHaveBeenCalledWith(chartData, 'dark');
    });

    expect(screen.getByRole('heading', { name: 'Neo X overview' })).toBeInTheDocument();
    expect(screen.getByText('Transactions in range')).toBeInTheDocument();
    expect(screen.getByText('Average gas price')).toBeInTheDocument();
    expect(screen.getByText('Recent transactions')).toBeInTheDocument();
    expect(screen.getByText('Top ERC-20 tokens')).toBeInTheDocument();
    expect(screen.getByText('CommitStore')).toBeInTheDocument();
    expect(screen.getByText('NeoX BNB')).toBeInTheDocument();
    expect(screen.getByText('Available 2026-03-10 to 2026-04-08')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xfrom...from' })).toHaveAttribute(
      'href',
      'https://xexplorer.neo.org/address/0xfrom',
    );
    expect(screen.getByRole('link', { name: 'CommitStore' })).toHaveAttribute(
      'href',
      'https://xexplorer.neo.org/address/0xto',
    );
    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
  });
});
