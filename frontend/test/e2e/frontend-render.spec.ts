import { join } from 'node:path';
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import type {
  AdminLoginData,
  DashboardData,
  DayData,
  DaysData,
  DefiData,
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
      page.locator('.card span').getByText('Transactions excluding GAS claims'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Range analytics' })).toBeVisible();
    await expect(page.getByText('Top senders')).toBeVisible();
    await captureScreenshot(page, testInfo, 'dashboard.png');
  });

  test('defi page renders boundary and table', async ({ page }, testInfo) => {
    await seedAppPage(page, defiSeed);
    await expect(page.getByRole('heading', { name: 'DeFi analytics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Selected range' })).toBeVisible();
    await expect(page.getByText('$45,123.90')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estimated swap USD value' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'defi.png');
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

  test('admin login renders form fields', async ({ page }, testInfo) => {
    await seedAppPage(page, adminLoginSeed);
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await captureScreenshot(page, testInfo, 'admin-login.png');
  });
});
