import type React from 'react';
import { useEffect, useState } from 'react';
import { initDefiCharts } from '../../charts/defi';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import { useTheme } from '../theme';
import type {
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformancePeriod,
  DashboardTokenPerformanceWindow,
  DefiData,
  DefiLiquidityAsset,
  DefiSwapAsset,
  DefiSwapTransaction,
} from '../types';
import { delayStyle, ensureArray, getPageData } from '../utils';

const TOKEN_PERFORMANCE_PERIODS: Array<{
  key: DashboardTokenPerformancePeriod;
  label: string;
}> = [
  { key: 'last24h', label: '24h' },
  { key: 'last7d', label: '7 days' },
  { key: 'last30d', label: '30 days' },
];

const PerformanceCard: React.FC<{
  title: string;
  entry?: DashboardTokenPerformanceEntry;
}> = ({ title, entry }) => {
  return (
    <article
      className={`performance-card ${entry ? `is-${entry.tone}` : 'is-empty'}`}
      data-animate
      style={delayStyle('0.23s')}
    >
      <div className="performance-card-header">
        <span className="performance-card-label">{title}</span>
        {entry ? (
          <strong className={`performance-card-change is-${entry.tone}`}>
            {entry.changeLabel}
          </strong>
        ) : null}
      </div>
      {entry ? (
        <>
          <div className="performance-card-symbol mono">{entry.symbol}</div>
          <div className="performance-card-price">{entry.detail}</div>
        </>
      ) : (
        <p className="summary-subtitle performance-empty">No token price data available.</p>
      )}
    </article>
  );
};

const PerformanceWindow: React.FC<{
  window: DashboardTokenPerformanceWindow;
}> = ({ window }) => {
  return (
    <section className="token-performance-grid">
      <PerformanceCard title={`Top gainer · ${window.label}`} entry={window.gainers[0]} />
      <PerformanceCard title={`Top loser · ${window.label}`} entry={window.losers[0]} />
    </section>
  );
};

const LiquidityList: React.FC<{
  assets: DefiLiquidityAsset[];
}> = ({ assets }) => {
  return (
    <div className="list-card defi-list-card" data-animate style={delayStyle('0.28s')}>
      <h3>Tracked liquidity mix</h3>
      <p className="summary-subtitle">
        Known swap contract balances priced with the latest Flamingo market feed.
      </p>
      <ul className="defi-asset-list">
        {assets.map((asset) => (
          <li key={asset.symbol}>
            <div>
              <div className="mono">{asset.symbol}</div>
              <small>
                Balance {asset.balanceLabel}
                {asset.stablecoin ? ' · stablecoin' : ''}
              </small>
            </div>
            <strong>{asset.usdValueLabel}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SwapAssetList: React.FC<{
  assets: DefiSwapAsset[];
}> = ({ assets }) => {
  return (
    <div className="list-card defi-list-card" data-animate style={delayStyle('0.3s')}>
      <h3>Top swap assets</h3>
      <p className="summary-subtitle">
        Asset-side view from the captured primary transfer for each classified swap.
      </p>
      <ul className="defi-asset-list">
        {assets.map((asset) => (
          <li key={asset.assetLabel}>
            <div>
              <div className="mono">{asset.assetLabel}</div>
              <small>
                {asset.swaps} swaps · avg {asset.averageSwapUsdValue}
              </small>
            </div>
            <strong>{asset.usdVolume}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SwapTransactionList: React.FC<{
  title: string;
  items: DefiSwapTransaction[];
  animateDelay: string;
}> = ({ title, items, animateDelay }) => {
  return (
    <div className="list-card defi-list-card" data-animate style={delayStyle(animateDelay)}>
      <h3>{title}</h3>
      <ul className="defi-swap-list">
        {items.map((item) => (
          <li key={`${title}-${item.txid}`}>
            <div>
              <div className="mono">{item.shortTxid}</div>
              <small>{item.timestampLabel}</small>
              <small>
                {item.assetLabel} · {item.amountLabel}
                {item.method ? ` · ${item.method}` : ''}
              </small>
            </div>
            <div className="defi-swap-value">
              <strong>{item.usdValueLabel}</strong>
              <a href={item.dayHref}>Open {item.dayLabel}</a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DefiPage: React.FC = () => {
  const { theme } = useTheme();
  const data = getPageData<DefiData>();
  const totals = data.totals ?? null;
  const tokenPerformance = data.tokenPerformance;
  const onChainOverview = data.onChainOverview ?? null;
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? 'No data available';
  const topLiquidityAssets = ensureArray(onChainOverview?.topLiquidityAssets);
  const topSwapAssets = ensureArray(data.topSwapAssets);
  const largestSwaps = ensureArray(data.largestSwaps);
  const recentSwaps = ensureArray(data.recentSwaps);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardTokenPerformancePeriod>('last24h');
  const selectedWindow = tokenPerformance ? tokenPerformance[selectedPeriod] : null;

  useEffect(() => {
    if (data.chartData) {
      initDefiCharts(data.chartData, theme);
    }
  }, [data.chartData, theme]);

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <section className="range-analytics-section">
        <div className="range-analytics-header" data-animate style={delayStyle('0.02s')}>
          <div>
            <h2>DeFi analytics</h2>
            <p className="summary-subtitle">
              Blockchain-derived swap metrics for the selected window.
            </p>
          </div>
          <span className="pill">{rangeLabel}</span>
        </div>
        <DateRangeForm from={rangeFrom} to={rangeTo} animateDelay="0.05s" />
      </section>

      {totals ? (
        <section className="summary-section" data-animate style={delayStyle('0.08s')}>
          <div className="summary-header">
            <div>
              <h2>Selected range</h2>
            </div>
          </div>
          <div className="summary-grid">
            <div className="card accent">
              <span>DEX volume</span>
              <strong>{totals.estimatedSwapUsdValue}</strong>
            </div>
            <div className="card">
              <span>Swap transactions</span>
              <strong>{totals.swaps}</strong>
            </div>
            <div className="card">
              <span>Average per swap</span>
              <strong>{totals.averageSwapUsdValue}</strong>
            </div>
            <div className="card">
              <span>Active swap wallets</span>
              <strong>{totals.activeSwapWallets}</strong>
            </div>
            <div className="card">
              <span>DeFi share of activity</span>
              <strong>{totals.activityShare}</strong>
              <small>Swaps / transactions excluding GAS claims</small>
            </div>
            <div className="card">
              <span>Covered days</span>
              <strong>{totals.coveredDays}</strong>
              <small>{totals.requestedDays} requested days</small>
            </div>
          </div>
        </section>
      ) : (
        <section className="empty-state" data-animate style={delayStyle('0.08s')}>
          <h2>No DeFi swaps in this range</h2>
          <p>Try a wider date window or a more recent period to inspect on-chain swap activity.</p>
        </section>
      )}

      {onChainOverview ? (
        <section className="summary-section" data-animate style={delayStyle('0.12s')}>
          <div className="summary-header">
            <div>
              <h2>On-chain liquidity and recent volume</h2>
              <p className="summary-subtitle">
                Latest DEX volume plus a tracked TVL proxy built from known swap contract balances.
              </p>
            </div>
          </div>
          <div className="summary-grid">
            <div className="card">
              <span>Yesterday DEX volume</span>
              <strong>{onChainOverview.latestDayDexVolume}</strong>
              <small>{onChainOverview.latestDayLabel}</small>
            </div>
            <div className="card">
              <span>Last 7 days DEX volume</span>
              <strong>{onChainOverview.last7dDexVolume}</strong>
              <small>{onChainOverview.last7dLabel}</small>
            </div>
            <div className="card accent">
              <span>Tracked DEX TVL</span>
              <strong>{onChainOverview.trackedTvl ?? '-'}</strong>
              <small>
                {onChainOverview.trackedContracts ?? '-'} contracts ·{' '}
                {onChainOverview.pricedAssets ?? '-'} priced assets
              </small>
            </div>
            <div className="card">
              <span>Stablecoin liquidity</span>
              <strong>{onChainOverview.stablecoinLiquidity ?? '-'}</strong>
              <small>{onChainOverview.stablecoinShare ?? '-'} of tracked TVL</small>
            </div>
          </div>
          {onChainOverview.recentVolumeNotice ? (
            <p className="summary-subtitle">{onChainOverview.recentVolumeNotice}</p>
          ) : null}
        </section>
      ) : null}

      {tokenPerformance ? (
        <section
          className="summary-section token-performance-section"
          data-animate
          style={delayStyle('0.16s')}
        >
          <div className="summary-header">
            <div>
              <h2>Token performance</h2>
              <p className="summary-subtitle">Best and worst performer for the selected window.</p>
            </div>
            <div className="token-performance-controls" role="tablist" aria-label="Time range">
              {TOKEN_PERFORMANCE_PERIODS.map((period) => (
                <button
                  key={period.key}
                  className={`token-performance-button ${
                    selectedPeriod === period.key ? 'is-active' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={selectedPeriod === period.key}
                  onClick={() => {
                    setSelectedPeriod(period.key);
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          {selectedWindow ? <PerformanceWindow window={selectedWindow} /> : null}
        </section>
      ) : null}

      {topLiquidityAssets.length > 0 || topSwapAssets.length > 0 ? (
        <section className="list-grid">
          {topLiquidityAssets.length > 0 ? <LiquidityList assets={topLiquidityAssets} /> : null}
          {topSwapAssets.length > 0 ? <SwapAssetList assets={topSwapAssets} /> : null}
        </section>
      ) : null}

      {data.chartData ? (
        <section className="chart-grid">
          <div className="chart-card wide" data-animate style={delayStyle('0.22s')}>
            <div className="chart-title">
              <h3>Estimated swap USD value</h3>
              <span>Per day</span>
            </div>
            <div className="chart-area">
              <canvas id="chart-defi-swap-usd" className="chart-canvas"></canvas>
            </div>
          </div>
          <div className="chart-card tall" data-animate style={delayStyle('0.26s')}>
            <div className="chart-title">
              <h3>Swap transactions</h3>
              <span>Per day</span>
            </div>
            <div className="chart-area">
              <canvas id="chart-defi-swaps" className="chart-canvas"></canvas>
            </div>
          </div>
        </section>
      ) : null}

      {largestSwaps.length > 0 || recentSwaps.length > 0 ? (
        <section className="list-grid">
          {largestSwaps.length > 0 ? (
            <SwapTransactionList title="Largest swaps" items={largestSwaps} animateDelay="0.34s" />
          ) : null}
          {recentSwaps.length > 0 ? (
            <SwapTransactionList title="Recent swaps" items={recentSwaps} animateDelay="0.38s" />
          ) : null}
        </section>
      ) : null}
    </main>
  );
};
