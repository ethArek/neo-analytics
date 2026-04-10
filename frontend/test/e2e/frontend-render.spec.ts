import { join } from 'node:path';
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import type {
  AdminLoginData,
  AssetData,
  DashboardData,
  DayData,
  DaysData,
  DefiData,
  NeoXData,
} from '../../src/app/types';
import type { PageSeed } from './frontend-render.types';

const stylesPath = join(process.cwd(), 'public', 'css', 'styles.css');

const dashboardSeed: PageSeed<DashboardData> = {
  page: 'dashboard',
  data: {
    nav: {
      dashboard: true,
    },
    totals: {
      totalTxs: '12,345',
      transactionsExcludingGasClaims: '9,876',
      oracle: '123',
      others: '456',
      activeAddresses: '4,321',
      neoVolume: '1,234',
      gasVolume: '567',
      blocks: '1,440',
    },
    rangeLabel: 'Jan 01, 2026 - Jan 07, 2026',
    rangeFrom: '2026-01-01',
    rangeTo: '2026-01-07',
    topSenders: [
      {
        address: 'Ncd3VvN5HxU5TYBv5yB6zG4u8x9z1Z',
        shortAddress: 'Ncd3Vv...1Z',
        transferCount: '120',
      },
    ],
    topReceivers: [
      {
        address: 'NfP4qQf1m5Yk2y8nWf2g9f6a1v7t3N',
        shortAddress: 'NfP4qQ...3N',
        transferCount: '98',
      },
    ],
    assetBreakdown: [
      {
        assetLabel: 'NEO',
        transferCount: '320',
        volumeLabel: '2400',
      },
      {
        assetLabel: 'GAS',
        transferCount: '280',
        volumeLabel: '900.1234',
      },
    ],
  },
};

const defiSeed: PageSeed<DefiData> = {
  page: 'defi',
  data: {
    nav: {
      defi: true,
    },
    tokenPerformance: {
      last24h: {
        label: 'Last 24h',
        gainers: [
          {
            symbol: 'FUSD',
            detail: '$1.00',
            changeLabel: '+0.15%',
            tone: 'positive',
          },
        ],
        losers: [
          {
            symbol: 'GAS',
            detail: '$3.21',
            changeLabel: '-1.10%',
            tone: 'negative',
          },
        ],
      },
      last7d: {
        label: 'Last 7 days',
        gainers: [
          {
            symbol: 'NEO',
            detail: '$12.34',
            changeLabel: '+5.20%',
            tone: 'positive',
          },
        ],
        losers: [
          {
            symbol: 'WBTC',
            detail: '$65,000.00',
            changeLabel: '-2.30%',
            tone: 'negative',
          },
        ],
      },
      last30d: {
        label: 'Last 30 days',
        gainers: [
          {
            symbol: 'bNEO',
            detail: '$13.10',
            changeLabel: '+12.00%',
            tone: 'positive',
          },
        ],
        losers: [
          {
            symbol: 'FLM',
            detail: '$0.08',
            changeLabel: '-9.20%',
            tone: 'negative',
          },
        ],
      },
    },
    onChainOverview: {
      latestDayDexVolume: '$12,000.00',
      latestDayLabel: '2026-03-10',
      last7dDexVolume: '$45,123.90',
      last7dLabel: '2026-03-04 to 2026-03-10',
      recentVolumeNotice: 'Partial coverage',
      trackedTvl: '$719,999.31',
      stablecoinLiquidity: '$306,986.22',
      stablecoinShare: '42.64%',
      poolCount: '60',
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
    totals: {
      estimatedSwapUsdValue: '$45,123.90',
      swaps: '321',
      averageSwapUsdValue: '$140.57',
      coveredDays: '4',
      requestedDays: '10',
    },
    chartData: {
      labels: ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'],
      series: {
        swapUsdValue: [12000, 9800, 11123.9, 12200],
        swaps: [80, 75, 82, 84],
      },
    },
  },
};

const neoXSeed: PageSeed<NeoXData> = {
  page: 'neo-x',
  data: {
    nav: {
      neoX: true,
    },
    status: 'ready',
    rangeLabel: '2026-04-01 to 2026-04-08',
    rangeFrom: '2026-04-01',
    rangeTo: '2026-04-08',
    availableRangeLabel: '2026-03-10 to 2026-04-08',
    summaryCards: [
      {
        label: 'Transactions in range',
        value: '4,799',
        detail: '8 days covered',
        accent: true,
      },
      {
        label: 'Average gas price',
        value: '39.21 Gwei',
        detail: 'Explorer-reported average',
      },
      {
        label: 'Total addresses',
        value: '17,512',
        detail: 'Explorer-reported network total',
      },
    ],
    chartData: {
      labels: ['2026-04-06', '2026-04-07', '2026-04-08'],
      series: {
        transactions: [311, 503, 406],
        rollingAverage: [311, 407, 407],
        cumulativeTransactions: [311, 814, 1220],
      },
    },
    recentTransactions: [
      {
        hash: '0xabc123',
        shortHash: '0xabc1...c123',
        timestampLabel: '2026-04-09 17:11:50 UTC',
        methodLabel: 'transmit',
        statusLabel: 'Success',
        fromLabel: '0x895e...5C2F',
        fromMeta: '0x895efB0Fd69712a36b13143533287Ece94FD5C2F',
        fromHref: 'https://xexplorer.neo.org/address/0x895efB0Fd69712a36b13143533287Ece94FD5C2F',
        toLabel: 'CommitStore',
        toMeta: '0xA449B032Ee7A6e35e4dd20dBBbDDf75783a2370d',
        toHref: 'https://xexplorer.neo.org/address/0xA449B032Ee7A6e35e4dd20dBBbDDf75783a2370d',
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
  },
};

const daysSeed: PageSeed<DaysData> = {
  page: 'days',
  data: {
    nav: {
      dashboard: true,
    },
    rangeLabel: 'Jan 01, 2026 - Jan 03, 2026',
    rangeFrom: '2026-01-01',
    rangeTo: '2026-01-03',
    stats: [
      {
        dateLabel: '2026-01-01',
        totalTxCountLabel: '1,200',
        swapsCountLabel: '120',
        oracleCountLabel: '20',
        transfersCountLabel: '980',
        gasClaimsCountLabel: '70',
        othersCountLabel: '30',
        transactionsExcludingGasClaimsLabel: '1,100',
      },
      {
        dateLabel: '2026-01-02',
        totalTxCountLabel: '1,050',
        swapsCountLabel: '100',
        oracleCountLabel: '15',
        transfersCountLabel: '830',
        gasClaimsCountLabel: '80',
        othersCountLabel: '40',
        transactionsExcludingGasClaimsLabel: '970',
      },
    ],
  },
};

const daySeed: PageSeed<DayData> = {
  page: 'day',
  data: {
    nav: {
      dashboard: true,
    },
    date: '2026-01-02',
    stat: {
      totalTxCount: 1050,
      transactionsExcludingGasClaims: 970,
      oracleCount: 25,
      uniqueAddresses: 620,
      neoVolume: '480',
      gasVolume: '220',
      othersCount: 40,
      blockCount: 1440,
    },
    assetStats: [
      {
        assetLabel: 'NEO',
        transferCount: 210,
        volumeLabel: '1200',
      },
      {
        assetLabel: 'GAS',
        transferCount: 190,
        volumeLabel: '900',
      },
    ],
    transactions: [
      {
        timestampLabel: '2026-01-02 02:10',
        shortTxid: '0xabc123',
        type: 'swap',
        assetLabel: 'NEO',
        amountLabel: '120',
        from: 'Ncd3Vv...1Z',
        to: 'NfP4qQ...3N',
        method: 'swap',
      },
      {
        timestampLabel: '2026-01-02 04:32',
        shortTxid: '0xdef456',
        type: 'transfer',
        assetLabel: 'GAS',
        amountLabel: '45',
        from: 'NfP4qQ...3N',
        to: 'Ncd3Vv...1Z',
        method: 'transfer',
      },
    ],
  },
};

const faqSeed: PageSeed<DashboardData> = {
  page: 'faq',
  data: {
    nav: {
      faq: true,
    },
  },
};

const assetSeed: PageSeed<AssetData> = {
  page: 'asset',
  data: {
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
        transferCount: '44',
        volumeLabel: '5,500.00',
      },
    ],
    topReceivers: [
      {
        address: 'Nreceiver',
        shortAddress: 'Nrece...iver',
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
  },
};

const adminLoginSeed: PageSeed<AdminLoginData> = {
  page: 'admin-login',
  data: {
    email: 'ops@example.com',
  },
};

const seedAppPage = async (page: Page, seed: PageSeed<unknown>) => {
  await page.addInitScript(
    ({ pageName, pageData }) => {
      window.__PAGE__ = pageName;
      window.__PAGE_DATA__ = pageData;
    },
    { pageName: seed.page, pageData: seed.data },
  );
  await page.goto('/');
  await page.waitForSelector('main.container');
  await page.addStyleTag({ path: stylesPath });
  await page.addStyleTag({
    content: '*{animation:none !important;transition:none !important}',
  });
};

const captureScreenshot = async (page: Page, testInfo: TestInfo, fileName: string) => {
  const screenshotPath = testInfo.outputPath(fileName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(fileName, { path: screenshotPath, contentType: 'image/png' });
};

test.describe('frontend rendering', () => {
  test('dashboard renders summary and lists', async ({ page }, testInfo) => {
    await seedAppPage(page, dashboardSeed);
    await expect(page.getByRole('heading', { name: 'Yesterday stats' })).toBeVisible();
    await expect(
      page.locator('.summary-grid span').filter({ hasText: /^Transactions excluding GAS claims$/ }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Range analytics' })).toBeVisible();
    await expect(page.getByText('Top senders')).toBeVisible();
    await captureScreenshot(page, testInfo, 'dashboard.png');
  });

  test('defi page renders boundary and table', async ({ page }, testInfo) => {
    await seedAppPage(page, defiSeed);
    await expect(page.getByRole('heading', { name: 'DeFi overview' })).toBeVisible();
    await expect(page.getByText('On-chain liquidity and recent volume')).toBeVisible();
    await expect(page.getByText('Partial coverage')).toBeVisible();
    await expect(page.getByText('$12,000.00')).toBeVisible();
    await captureScreenshot(page, testInfo, 'defi.png');
  });

  test('neo x page renders explorer-backed overview and lists', async ({ page }, testInfo) => {
    await seedAppPage(page, neoXSeed);
    await expect(page.getByRole('heading', { name: 'Neo X overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent transactions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top ERC-20 tokens' })).toBeVisible();
    await expect(page.getByText('CommitStore')).toBeVisible();
    await expect(page.getByRole('link', { name: '0x895e...5C2F' })).toHaveAttribute(
      'href',
      'https://xexplorer.neo.org/address/0x895efB0Fd69712a36b13143533287Ece94FD5C2F',
    );
    await captureScreenshot(page, testInfo, 'neo-x.png');
  });

  test('days table renders range rows', async ({ page }, testInfo) => {
    await seedAppPage(page, daysSeed);
    await expect(page.getByText('Daily activity table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total txs' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-01-02' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'days.png');
  });

  test('day detail renders breakdowns and table', async ({ page }, testInfo) => {
    await seedAppPage(page, daySeed);
    await expect(page.getByText('Day details: 2026-01-02')).toBeVisible();
    await expect(page.getByText('Asset transfer volume')).toBeVisible();
    await expect(page.getByRole('cell', { name: '0xabc123' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'day.png');
  });

  test('faq renders accordion and call to action', async ({ page }, testInfo) => {
    await seedAppPage(page, faqSeed);
    await expect(
      page.getByRole('heading', { name: 'Clear answers to how Neo Analytics works.' }),
    ).toBeVisible();
    await expect(page.getByText('How often is data updated?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open dashboard' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'faq.png');
  });

  test('asset page renders detail sections', async ({ page }, testInfo) => {
    await seedAppPage(page, assetSeed);
    await expect(page.getByRole('heading', { name: 'FUSD' })).toBeVisible();
    await expect(page.getByText('DeFi relation')).toBeVisible();
    await expect(page.getByText('Recent transactions')).toBeVisible();
    await captureScreenshot(page, testInfo, 'asset.png');
  });

  test('admin login renders form fields', async ({ page }, testInfo) => {
    await seedAppPage(page, adminLoginSeed);
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await captureScreenshot(page, testInfo, 'admin-login.png');
  });
});
