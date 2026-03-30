import type React from 'react';
import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import type {
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformancePeriod,
  DashboardTokenPerformanceWindow,
  DefiData,
  DefiLiquidityAsset,
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
      <h3>Flamingo liquidity mix</h3>
      <p className="summary-subtitle">
        Live Flamingo pool balances priced with the latest Flamingo market feed.
      </p>
      <ul className="defi-asset-list">
        {assets.map((asset) => (
          <li key={asset.symbol}>
            <div>
              <div className="mono">{asset.symbol}</div>
              <small className="defi-asset-meta">
                <span>Balance {asset.balanceLabel}</span>
                {asset.stablecoin ? <span className="defi-asset-badge">Stablecoin</span> : null}
              </small>
            </div>
            <strong>{asset.usdValueLabel}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DefiPage: React.FC = () => {
  const data = getPageData<DefiData>();
  const tokenPerformance = data.tokenPerformance;
  const onChainOverview = data.onChainOverview ?? null;
  const topLiquidityAssets = ensureArray(onChainOverview?.topLiquidityAssets);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardTokenPerformancePeriod>('last24h');
  const selectedWindow = tokenPerformance ? tokenPerformance[selectedPeriod] : null;

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <section className="summary-section" data-animate style={delayStyle('0.02s')}>
        <div className="summary-header">
          <div>
            <h2>DeFi overview</h2>
            <p className="summary-subtitle">
              Live liquidity, recent DEX volume, and token performance from current on-chain data.
            </p>
          </div>
        </div>
      </section>

      {onChainOverview ? (
        <section className="summary-section" data-animate style={delayStyle('0.08s')}>
          <div className="summary-header">
            <div>
              <h2>On-chain liquidity and recent volume</h2>
              <p className="summary-subtitle">
                Recent DEX volume from Flamingo Analytics swap volume plus live Flamingo pool TVL.
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
              <span>Flamingo TVL</span>
              <strong>{onChainOverview.trackedTvl ?? '-'}</strong>
              <small>
                {onChainOverview.poolCount ?? '-'} pools · {onChainOverview.pricedAssets ?? '-'}{' '}
                priced assets
              </small>
            </div>
            <div className="card">
              <span>Stablecoin liquidity</span>
              <strong>{onChainOverview.stablecoinLiquidity ?? '-'}</strong>
              <small>{onChainOverview.stablecoinShare ?? '-'} of Flamingo TVL</small>
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
          style={delayStyle('0.12s')}
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

      {topLiquidityAssets.length > 0 ? (
        <section className="list-grid">
          <LiquidityList assets={topLiquidityAssets} />
        </section>
      ) : null}
    </main>
  );
};
