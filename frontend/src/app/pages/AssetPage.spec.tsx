import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { AssetData } from '../types';
import { AssetPage } from './AssetPage';

describe('AssetPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders asset summary, DeFi context, and tables', () => {
    const data: AssetData = {
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
        dashboard: true,
      },
      assetLabel: 'FUSD',
      assetId: '0xfusd',
      rangeLabel: '2026-03-01 to 2026-03-07',
      rangeFrom: '2026-03-01',
      rangeTo: '2026-03-07',
      summary: {
        volumeLabel: '12,340.00',
        transferCount: '210',
        txCount: '140',
        activeAddresses: '98',
        uniqueSenders: '52',
        uniqueReceivers: '63',
        swapsCount: '82',
        transfersCount: '48',
        otherCount: '10',
        swapShare: '58.57%',
        transferShare: '34.29%',
        oracleCount: '4',
        gasClaimsCount: '1',
        ignoredCount: '5',
      },
      defiRelation: {
        marketSymbol: 'FUSD',
        currentPrice: '$1.00',
        change24h: '+0.15%',
        change7d: '-1.20%',
        change30d: '-2.10%',
        trackedLiquidityUsd: '$272,479.53',
        trackedLiquidityBalance: '293,276.14',
        stablecoin: true,
        hasMarketPrice: true,
        hasTrackedLiquidity: true,
      },
      typeBreakdown: [
        {
          key: 'SWAP',
          label: 'Swap',
          count: '82',
          share: '58.57%',
        },
        {
          key: 'NORMAL_TRANSFER',
          label: 'Transfer',
          count: '48',
          share: '34.29%',
        },
      ],
      dailyActivity: [
        {
          dateLabel: '2026-03-07',
          dayHref: '/day/2026-03-07',
          transferCount: '32',
          txCount: '20',
          uniqueSenders: '12',
          uniqueReceivers: '14',
          volumeLabel: '1,240.00',
        },
      ],
      topSenders: [
        {
          address: 'Nsender',
          shortAddress: 'Nsend...nder',
          addressLabel: 'Flamingo',
          transferCount: '44',
          volumeLabel: '5,500.00',
        },
      ],
      topReceivers: [
        {
          address: 'Nreceiver',
          shortAddress: 'Nrece...iver',
          addressLabel: 'Vault',
          transferCount: '40',
          volumeLabel: '4,800.00',
        },
      ],
      recentTransactions: [
        {
          txid: '0xabc123',
          shortTxid: '0xabc1...c123',
          timestampLabel: '2026-03-07 12:30 UTC',
          dayLabel: '2026-03-07',
          dayHref: '/day/2026-03-07',
          type: 'Swap',
          amountLabel: '1,000.00',
          transferCount: '2',
          method: 'swapTokens',
        },
      ],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <AssetPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: 'FUSD' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Transfer volume, active addresses, transaction mix, and DeFi context for the selected asset.',
      ),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
    expect(screen.getByText('Active addresses')).toBeInTheDocument();
    expect(screen.getByText('58.57%')).toBeInTheDocument();
    expect(screen.getByText('DeFi relation')).toBeInTheDocument();
    expect(screen.getByText('$272,479.53')).toBeInTheDocument();
    expect(screen.getByText('Stablecoin')).toBeInTheDocument();
    expect(screen.getByText('Activity mix')).toBeInTheDocument();
    expect(screen.getByText('Top senders')).toBeInTheDocument();
    expect(screen.getByText('Nsend...nder (Flamingo)')).toBeInTheDocument();
    expect(screen.getByText('Top receivers')).toBeInTheDocument();
    expect(screen.getByText('Daily activity')).toBeInTheDocument();
    const dayLinks = screen.getAllByRole('link', { name: '2026-03-07' });

    expect(dayLinks).toHaveLength(2);
    expect(dayLinks[0]).toHaveAttribute('href', '/day/2026-03-07');
    expect(dayLinks[1]).toHaveAttribute('href', '/day/2026-03-07');
    expect(screen.getByText('Recent transactions')).toBeInTheDocument();
    expect(screen.getByText('0xabc1...c123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard?from=2026-03-01&to=2026-03-07',
    );
  });

  it('renders a single empty state when there is no indexed or DeFi context', () => {
    const data: AssetData = {
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
        dashboard: true,
      },
      assetLabel: 'Unknown asset',
      assetId: '0xunknown',
      rangeLabel: '2026-03-01 to 2026-03-07',
      rangeFrom: '2026-03-01',
      rangeTo: '2026-03-07',
      summary: null,
      defiRelation: null,
      typeBreakdown: [],
      dailyActivity: [],
      topSenders: [],
      topReceivers: [],
      recentTransactions: [],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <AssetPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('No indexed context for this asset yet')).toBeInTheDocument();
    expect(screen.queryByText('No activity in the selected range')).not.toBeInTheDocument();
    expect(screen.queryByText('DeFi relation')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity mix')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent transactions')).not.toBeInTheDocument();
  });

  it('shows DeFi context without empty activity tables when only market data exists', () => {
    const data: AssetData = {
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
        dashboard: true,
      },
      assetLabel: 'FUSD',
      assetId: '0xfusd',
      rangeLabel: '2026-03-01 to 2026-03-07',
      rangeFrom: '2026-03-01',
      rangeTo: '2026-03-07',
      summary: null,
      defiRelation: {
        marketSymbol: 'FUSD',
        currentPrice: '$1.00',
        change24h: '+0.15%',
        change7d: '-1.20%',
        change30d: '-2.10%',
        trackedLiquidityUsd: null,
        trackedLiquidityBalance: null,
        stablecoin: true,
        hasMarketPrice: true,
        hasTrackedLiquidity: false,
      },
      typeBreakdown: [],
      dailyActivity: [],
      topSenders: [],
      topReceivers: [],
      recentTransactions: [],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <AssetPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('No activity in the selected range')).toBeInTheDocument();
    expect(screen.getByText('DeFi relation')).toBeInTheDocument();
    expect(screen.queryByText('No indexed context for this asset yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity mix')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent transactions')).not.toBeInTheDocument();
  });
});
