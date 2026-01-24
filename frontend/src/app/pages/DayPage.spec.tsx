import React from 'react';
import { render, screen } from '@testing-library/react';
import { DayPage } from './DayPage';
import type { DayData } from '../types';

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
      methodStats: [
        {
          method: 'transfer',
          txCount: 5,
        },
      ],
      contractStats: [
        {
          contract: 'contract-1',
          txCount: 2,
        },
      ],
      transactions: [
        {
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
    };

    window.__PAGE_DATA__ = data;

    render(<DayPage />);

    expect(screen.getByText('Day details: 2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('Asset breakdown')).toBeInTheDocument();
    expect(screen.getByText('tx-1')).toBeInTheDocument();
  });

  it('shows a message when no stats exist', () => {
    const data: DayData = {
      date: '2024-01-02',
      stat: null,
      transactions: [],
      assetStats: [],
      methodStats: [],
      contractStats: [],
    };

    window.__PAGE_DATA__ = data;

    render(<DayPage />);

    expect(screen.getByText('No stats found for this day.')).toBeInTheDocument();
  });
});
