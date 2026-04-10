import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

jest.mock('../charts/dashboard', () => ({
  initDashboardCharts: jest.fn(),
}));

jest.mock('../charts/defi', () => ({
  initDefiCharts: jest.fn(),
}));

jest.mock('../charts/neo-x', () => ({
  initNeoXCharts: jest.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    delete window.__PAGE__;
    delete window.__PAGE_DATA__;
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the requested page', () => {
    window.__PAGE__ = 'faq';
    window.__PAGE_DATA__ = {
      nav: {
        faq: true,
      },
    };

    render(<App />);

    expect(screen.getByText(/Clear answers to how Neo Analytics works/i)).toBeInTheDocument();
  });

  it('renders the asset page when requested', () => {
    window.__PAGE__ = 'asset';
    window.__PAGE_DATA__ = {
      assetLabel: 'FUSD',
      assetId: '0xfusd',
      rangeLabel: '2026-03-01 to 2026-03-07',
      summary: {
        volumeLabel: '1,000.00',
        transferCount: '10',
        txCount: '8',
        activeAddresses: '6',
        uniqueSenders: '3',
        uniqueReceivers: '4',
        swapsCount: '5',
        transfersCount: '2',
        otherCount: '1',
        swapShare: '62.50%',
        transferShare: '25.00%',
        oracleCount: '1',
        gasClaimsCount: '0',
        ignoredCount: '0',
      },
      defiRelation: {
        marketSymbol: 'FUSD',
        currentPrice: '$1.00',
        change24h: '+0.10%',
        change7d: null,
        change30d: null,
        trackedLiquidityUsd: '$100.00',
        trackedLiquidityBalance: '100.00',
        stablecoin: true,
        hasMarketPrice: true,
        hasTrackedLiquidity: true,
      },
      typeBreakdown: [],
      dailyActivity: [],
      topSenders: [],
      topReceivers: [],
      recentTransactions: [],
    };

    render(<App />);

    expect(screen.getByRole('heading', { name: 'FUSD' })).toBeInTheDocument();
    expect(screen.getByText('DeFi relation')).toBeInTheDocument();
  });

  it('renders the Neo X page when requested', () => {
    window.__PAGE__ = 'neo-x';
    window.__PAGE_DATA__ = {
      nav: {
        neoX: true,
      },
      rangeLabel: '2026-04-01 to 2026-04-08',
      summaryCards: [
        {
          label: 'Transactions in range',
          value: '300',
        },
      ],
      recentTransactions: [],
      topTokens: [],
    };

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Neo X overview' })).toBeInTheDocument();
    expect(screen.getByText('Transactions in range')).toBeInTheDocument();
  });

  it('falls back to the dashboard page', () => {
    render(<App />);

    expect(screen.getByText('Yesterday stats')).toBeInTheDocument();
  });

  it('toggles dark mode and persists the selected theme', () => {
    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    const toggle = screen.getByRole('button', { name: /switch to light mode/i });
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('neo-analytics-theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('uses the stored light mode preference on first render', () => {
    window.localStorage.setItem('neo-analytics-theme', 'light');

    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
