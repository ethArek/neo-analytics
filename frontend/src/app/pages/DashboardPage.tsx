import React, { useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { delayStyle, ensureArray, getPageData } from '../utils';
import type { DashboardData } from '../types';
import { initDashboardCharts } from '../../charts/dashboard';

export const DashboardPage: React.FC = () => {
  const data = getPageData<DashboardData>();
  const totals = data.totals;
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? '';
  const topSenders = ensureArray(data.topSenders);
  const topReceivers = ensureArray(data.topReceivers);

  useEffect(() => {
    if (data.chartData) {
      initDashboardCharts(data.chartData);
    }
  }, [data.chartData]);

  return (
    <main className="container">
      <Navbar nav={data.nav} />
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
            <span>Transactions excluding Gas Claims</span>
            <strong>{totals?.realUsage}</strong>
            <small>Swaps + transfers</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.15s')}>
            <span>Active addresses</span>
            <strong>{totals?.activeAddresses}</strong>
            <small>Unique senders + receivers</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.2s')}>
            <span>NEO volume</span>
            <strong>{totals?.neoVolume} NEO</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.25s')}>
            <span>GAS volume</span>
            <strong>{totals?.gasVolume} GAS</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.35s')}>
            <span>Blocks scanned</span>
            <strong>{totals?.blocks}</strong>
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
            <a className="button secondary" href={`/days?from=${rangeFrom}&to=${rangeTo}`}>
              Daily table
            </a>
            <span className="pill">{rangeLabel}</span>
          </div>
        </div>
        <form className="range-form" method="get" data-animate style={delayStyle('0.34s')}>
          <label>
            From
            <input type="date" name="from" defaultValue={rangeFrom} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={rangeTo} />
          </label>
          <button className="button" type="submit">
            Apply
          </button>
        </form>
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
            <h3>Total transactions excluding Gas Claims</h3>
            <span>Per day (range)</span>
          </div>
          <div className="chart-area">
            <canvas id="chart-real-usage" className="chart-canvas"></canvas>
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
          <h3>Top senders</h3>
          <ul>
            {topSenders.map((sender) => (
              <li key={sender.address}>
                <div>
                  <div className="mono">{sender.shortAddress}</div>
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
                  <div className="mono">{receiver.shortAddress}</div>
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
