import type React from 'react';
import { useEffect } from 'react';
import { initDashboardCharts } from '../../charts/dashboard';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import { useTheme } from '../theme';
import type { DashboardData } from '../types';
import { buildPageHref, delayStyle, ensureArray, getPageData } from '../utils';

const formatTopAddressLabel = (shortAddress: string, addressLabel?: string): string => {
  if (!addressLabel) {
    return shortAddress;
  }

  return `${shortAddress} (${addressLabel})`;
};

export const DashboardPage: React.FC = () => {
  const { theme } = useTheme();
  const data = getPageData<DashboardData>();
  const totals = data.totals;
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? '';
  const topSenders = ensureArray(data.topSenders);
  const topReceivers = ensureArray(data.topReceivers);
  const assetBreakdown = ensureArray(data.assetBreakdown);
  const daysHref = buildPageHref('/days', { from: rangeFrom, to: rangeTo });

  useEffect(() => {
    if (data.chartData) {
      initDashboardCharts(data.chartData, theme);
    }
  }, [data.chartData, theme]);

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />
      <section className="summary-section">
        <div className="summary-header" data-animate style={delayStyle('0.02s')}>
          <div>
            <h2>Yesterday stats</h2>
          </div>
          {rangeTo ? <span className="range-pill">{rangeTo}</span> : null}
        </div>
        <div className="summary-grid">
          <div className="card accent" data-animate style={delayStyle('0.05s')}>
            <span>Transactions</span>
            <strong>{totals?.totalTxs}</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.1s')}>
            <span>Transactions excluding GAS claims</span>
            <strong>{totals?.transactionsExcludingGasClaims}</strong>
            <small>Total transactions - GAS claims</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.2s')}>
            <span>Oracle transactions (subset)</span>
            <strong>{totals?.oracle}</strong>
            <small>Included in transactions excluding GAS claims</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.23s')}>
            <span>Active addresses</span>
            <strong>{totals?.activeAddresses}</strong>
            <small>Unique senders + receivers</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.26s')}>
            <span>NEO volume</span>
            <strong>{totals?.neoVolume} NEO</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.3s')}>
            <span>GAS volume</span>
            <strong>{totals?.gasVolume} GAS</strong>
          </div>
        </div>
      </section>

      <section className="range-analytics-section">
        <div className="range-analytics-header" data-animate style={delayStyle('0.32s')}>
          <div>
            <h2>Range analytics</h2>
            <p className="summary-subtitle">Charts reflect the selected range.</p>
          </div>
          <div className="hero-links">
            <a className="button secondary" href={daysHref}>
              Daily table
            </a>
            <span className="pill">{rangeLabel}</span>
          </div>
        </div>
        <DateRangeForm from={rangeFrom} to={rangeTo} animateDelay="0.34s" />
      </section>

      <section className="chart-grid">
        <div className="chart-card wide" data-animate style={delayStyle('0.05s')}>
          <div className="chart-title">
            <h3>Total transactions</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-total-txs" className="chart-canvas"></canvas>
          </div>
        </div>
        <div className="chart-card tall" data-animate style={delayStyle('0.1s')}>
          <div className="chart-title">
            <h3>Mix by type</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-types" className="chart-canvas"></canvas>
          </div>
        </div>
        <div className="chart-card" data-animate style={delayStyle('0.12s')}>
          <div className="chart-title">
            <h3>Transactions excluding GAS claims</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-activity" className="chart-canvas"></canvas>
          </div>
        </div>
        <div className="chart-card" data-animate style={delayStyle('0.14s')}>
          <div className="chart-title">
            <h3>Swaps</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-swaps" className="chart-canvas"></canvas>
          </div>
        </div>
        <div className="chart-card" data-animate style={delayStyle('0.15s')}>
          <div className="chart-title">
            <h3>Active addresses</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-addresses" className="chart-canvas"></canvas>
          </div>
        </div>
        <div className="chart-card" data-animate style={delayStyle('0.2s')}>
          <div className="chart-title">
            <h3>Transfer activity by asset</h3>
            <span>Top assets</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-assets" className="chart-canvas"></canvas>
          </div>
        </div>
      </section>

      <section className="list-grid">
        <div className="list-card" data-animate style={delayStyle('0.35s')}>
          <h3>Asset transfer volume</h3>
          <ul className="asset-breakdown-list">
            {assetBreakdown.map((asset) => (
              <li key={asset.assetLabel}>
                <div>
                  <div className="mono">
                    {asset.assetHref ? (
                      <a href={asset.assetHref}>{asset.assetLabel}</a>
                    ) : (
                      asset.assetLabel
                    )}
                  </div>
                  <small>{asset.transferCount} transfers</small>
                </div>
                <strong>{asset.volumeLabel}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="list-grid">
        <div className="list-card" data-animate style={delayStyle('0.35s')}>
          <h3>Top senders</h3>
          <ul>
            {topSenders.map((sender) => (
              <li key={sender.address}>
                <div>
                  <div className="mono">
                    {formatTopAddressLabel(sender.shortAddress, sender.addressLabel)}
                  </div>
                  <small>{sender.address}</small>
                </div>
                <strong>{sender.transferCount}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="list-card" data-animate style={delayStyle('0.4s')}>
          <h3>Top receivers</h3>
          <ul>
            {topReceivers.map((receiver) => (
              <li key={receiver.address}>
                <div>
                  <div className="mono">
                    {formatTopAddressLabel(receiver.shortAddress, receiver.addressLabel)}
                  </div>
                  <small>{receiver.address}</small>
                </div>
                <strong>{receiver.transferCount}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};
