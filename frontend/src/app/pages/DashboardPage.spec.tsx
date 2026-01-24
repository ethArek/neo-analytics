import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import { initDashboardCharts } from '../../charts/dashboard';
import type { DashboardChartData, DashboardData } from '../types';

jest.mock('../../charts/dashboard', () => ({
  initDashboardCharts: jest.fn(),
}));

describe('DashboardPage', () => {
  const chartData: DashboardChartData = {
    labels: ['2024-01-01'],
    series: {
      swaps: [1],
      transfers: [2],
      gasClaims: [3],
      others: [4],
      realUsage: [5],
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

  it('initializes charts and renders top lists', async () => {
    const data: DashboardData = {
      totals: {
        totalTxs: '100',
        realUsage: '80',
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
          shortAddress: 'sender',
          transferCount: '10',
        },
      ],
      topReceivers: [
        {
          address: 'receiver-1',
          shortAddress: 'receiver',
          transferCount: '12',
        },
      ],
    };

    window.__PAGE_DATA__ = data;

    render(<DashboardPage />);

    const mockedInit = jest.mocked(initDashboardCharts);
    await waitFor(() => {
      expect(mockedInit).toHaveBeenCalledWith(chartData);
    });

    expect(screen.getByText('Top senders')).toBeInTheDocument();
    expect(screen.getByText('sender-1')).toBeInTheDocument();
    expect(screen.getByText('Top receivers')).toBeInTheDocument();
    expect(screen.getByText('receiver-1')).toBeInTheDocument();
  });
});
