import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { DayData } from '../types';
import { DayPage } from './DayPage';

describe('DayPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders the summary and tables when stats are present', () => {
    const data: DayData = {
      date: '2024-01-01',
      stat: {
        totalTxCount: 10,
        realUsageTotal: 8,
        uniqueAddresses: 4,
        neoVolume: '100',
        gasVolume: '50',
        othersCount: 2,
        blockCount: 1,
      },
      assetStats: [
        {
          assetLabel: 'NEO',
          transferCount: 3,
          volumeLabel: '20',
        },
      ],
      transactions: [
        {
          txid: '0x123',
          timestampLabel: '2024-01-01T00:00:00Z',
          shortTxid: 'tx-1',
          type: 'transfer',
          assetLabel: 'NEO',
          amountLabel: '10',
          from: 'from-1',
          to: 'to-1',
          method: 'transfer',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        totalItems: 3,
        totalPages: 3,
        hasPreviousPage: false,
        hasNextPage: true,
        pageSizeOptions: [1, 25, 50],
      },
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <DayPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('Day details: 2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('Asset transfer volume')).toBeInTheDocument();
    expect(screen.getByText('Transaction explorer')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 of 3 transactions')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/day/2024-01-01?page=2&pageSize=1',
    );
    expect(screen.getByText('tx-1')).toBeInTheDocument();
  });

  it('shows a message when no stats exist', () => {
    const data: DayData = {
      date: '2024-01-02',
      stat: null,
      transactions: [],
      assetStats: [],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <DayPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('No stats found for this day.')).toBeInTheDocument();
  });
});
