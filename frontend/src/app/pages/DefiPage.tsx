import type React from 'react';
import { useEffect, useState } from 'react';
import { initDefiCharts } from '../../charts/defi';
import { Navbar } from '../components/Navbar';
import { useTheme } from '../theme';
import type {
  DashboardTokenPerformanceEntry,
  DashboardTokenPerformancePeriod,
  DashboardTokenPerformanceWindow,
  DefiData,
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

export const DefiPage: React.FC = () => {
  const { theme } = useTheme();
  const data = getPageData<DefiData>();
  const dailyStats = ensureArray(data.dailyStats);
  const totals = data.totals;
  const tokenPerformance = data.tokenPerformance;
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardTokenPerformancePeriod>('last24h');
  const selectedWindow = tokenPerformance ? tokenPerformance[selectedPeriod] : null;

  useEffect(() => {
    if (data.chartData && dailyStats.length > 0) {
      initDefiCharts(data.chartData, theme);
    }
  }, [data.chartData, dailyStats.length, theme]);

  return (
    <main className="container">
      <Navbar nav={data.nav} />

      {totals ? (
        <section className="summary-section" data-animate style={delayStyle('0.18s')}>
          <div className="summary-header">
            <div>
              <h2>Totals</h2>
            </div>
          </div>
          <div className="summary-grid">
            <div className="card accent">
              <span>Estimated swap USD value</span>
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
              <span>Covered days</span>
              <strong>{totals.coveredDays}</strong>
              <small>{totals.requestedDays} requested days</small>
            </div>
          </div>
        </section>
      ) : null}

      {tokenPerformance ? (
        <section
          className="summary-section token-performance-section"
          data-animate
          style={delayStyle('0.2s')}
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

      {dailyStats.length > 0 ? (
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
    </main>
  );
};
