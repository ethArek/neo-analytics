import React, { useEffect } from 'react';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import { buildPageHref, delayStyle, ensureArray, getPageData } from '../utils';
import type { DefiData } from '../types';
import { initDefiCharts } from '../../charts/defi';

export const DefiPage: React.FC = () => {
  const data = getPageData<DefiData>();
  const dailyStats = ensureArray(data.dailyStats);
  const methodology = ensureArray(data.methodology);
  const banner = data.banner;
  const totals = data.totals;
  const requestedFrom = data.requestedFrom ?? '';
  const requestedTo = data.requestedTo ?? '';
  const effectiveFrom = data.effectiveFrom ?? requestedFrom;
  const effectiveTo = data.effectiveTo ?? requestedTo;
  const dashboardHref = buildPageHref('/dashboard', { from: effectiveFrom, to: effectiveTo });
  const daysHref = buildPageHref('/days', { from: effectiveFrom, to: effectiveTo });

  useEffect(() => {
    if (data.chartData && dailyStats.length > 0) {
      initDefiCharts(data.chartData);
    }
  }, [data.chartData, dailyStats.length]);

  return (
    <main className="container">
      <Navbar nav={data.nav} />

      <header className="hero faq-hero" data-animate style={delayStyle('0.04s')}>
        <div>
          <span className="pill">DeFi metrics</span>
          <h1>Estimated swap USD metrics with a clear historical boundary.</h1>
          <p className="subtitle">
            This page is intentionally separate from the core dashboard. The pricing methodology is
            different, the coverage starts on a published date, and earlier periods are excluded on
            purpose.
          </p>
          <div className="hero-meta">
            <span className="pill">Not TVL</span>
            <span className="pill">
              {data.availabilityFrom
                ? `Available since ${data.availabilityFrom}`
                : 'Availability date pending'}
            </span>
            <span className="pill">No retroactive backfill</span>
          </div>
        </div>
        <div className="faq-hero-card defi-hero-card">
          <div className="faq-stat">
            <span className="faq-label">Methodology</span>
            <strong>Estimated swap transfer value, not a historical market data feed.</strong>
            <p>
              We classify swap-like on-chain transactions, price eligible transfer legs at ingestion
              time, and keep the result on a separate page so the boundary stays explicit.
            </p>
          </div>
        </div>
      </header>

      <section
        className={`signal-banner is-${banner?.tone ?? 'neutral'}`}
        data-animate
        style={delayStyle('0.08s')}
      >
        <div className="signal-banner-copy">
          <span className="faq-tag">{banner?.statusLabel ?? 'DeFi window'}</span>
          <h2>{banner?.title ?? 'DeFi metrics'}</h2>
          <p>
            {banner?.body ?? 'This page publishes DeFi metrics only inside the configured window.'}
          </p>
        </div>
        <div className="signal-banner-meta">
          <div>
            <span>Published since</span>
            <strong>{data.availabilityFrom ?? 'Pending'}</strong>
          </div>
          <div>
            <span>Requested range</span>
            <strong>{data.requestedRangeLabel ?? 'Not selected'}</strong>
          </div>
          <div>
            <span>Used for charts</span>
            <strong>{data.effectiveRangeLabel ?? 'Not available'}</strong>
          </div>
        </div>
      </section>

      <section className="range-analytics-section">
        <div className="range-analytics-header" data-animate style={delayStyle('0.12s')}>
          <div>
            <h2>Range controls</h2>
            <p className="summary-subtitle">
              {data.coverageNote ??
                'If a selected range starts before the DeFi launch date, the page clamps it to the published window.'}
            </p>
          </div>
          <div className="hero-links">
            <a className="button secondary" href={dashboardHref}>
              Core dashboard
            </a>
            <a className="button secondary" href={daysHref}>
              Daily table
            </a>
          </div>
        </div>
        <DateRangeForm from={requestedFrom} to={requestedTo} animateDelay="0.14s" />
      </section>

      {totals ? (
        <section className="summary-section" data-animate style={delayStyle('0.18s')}>
          <div className="summary-header">
            <div>
              <h2>DeFi estimates</h2>
              <p className="summary-subtitle">
                Separate from the canonical chain activity metrics on the main dashboard.
              </p>
            </div>
          </div>
          <div className="summary-grid">
            <div className="card accent">
              <span>Estimated swap USD value</span>
              <strong>{totals.estimatedSwapUsdValue}</strong>
              <small>Sum of priced transfer legs in swap-classified transactions</small>
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

      {dailyStats.length > 0 ? (
        <>
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

          <section className="table" data-animate style={delayStyle('0.3s')}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Swaps</th>
                  <th>Estimated swap USD value</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((stat) => (
                  <tr key={stat.dateLabel}>
                    <td>
                      <a href={`/day/${stat.dateLabel}`}>{stat.dateLabel}</a>
                    </td>
                    <td>{stat.swapsLabel}</td>
                    <td>{stat.swapUsdValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="empty-state" data-animate style={delayStyle('0.22s')}>
          <h2>No DeFi rows to show</h2>
          <p>
            Either the selected range is outside the published availability window, or this window
            has not been ingested yet.
          </p>
        </section>
      )}

      <section className="list-grid" data-animate style={delayStyle('0.34s')}>
        <div className="list-card defi-list-card">
          <h3>How to read this page</h3>
          <ul className="defi-method-list">
            {methodology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="list-card defi-list-card">
          <h3>Why this page is separate</h3>
          <ul className="defi-method-list">
            <li>The main dashboard stays focused on full-history chain activity metrics.</li>
            <li>
              DeFi estimates only start on the published availability date for this deployment.
            </li>
            <li>
              Historical days before that date are intentionally excluded instead of filled with
              zeros.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
};
