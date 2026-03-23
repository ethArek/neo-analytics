import type React from 'react';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import { buildPageHref, delayStyle, ensureArray, getPageData } from '../utils';
import type { DaysData } from '../types';

export const DaysPage: React.FC = () => {
  const data = getPageData<DaysData>();
  const stats = ensureArray(data.stats);
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? '';
  const dashboardHref = buildPageHref('/dashboard', { from: rangeFrom, to: rangeTo });

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <h1>Neo Analytics</h1>
          <p className="subtitle">Daily activity table</p>
          <p className="hero-meta">
            Range: {rangeLabel}. Browse daily stats and drill into a specific day.
          </p>
        </div>
        <div className="hero-actions">
          <DateRangeForm from={rangeFrom} to={rangeTo} />
          <div className="hero-links">
            <a className="button secondary" href={dashboardHref}>
              Back to dashboard
            </a>
            <span className="pill">{rangeLabel}</span>
          </div>
        </div>
      </header>

      <section className="table" data-animate style={delayStyle('0.1s')}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Total txs</th>
              <th>Swaps</th>
              <th>Oracle (subset)</th>
              <th>Transfers</th>
              <th>Gas claims</th>
              <th>Others</th>
              <th>Tx excluding GAS claims</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.dateLabel}>
                <td>
                  <a href={`/day/${stat.dateLabel}`}>{stat.dateLabel}</a>
                </td>
                <td>{stat.totalTxCountLabel}</td>
                <td>{stat.swapsCountLabel}</td>
                <td>{stat.oracleCountLabel}</td>
                <td>{stat.transfersCountLabel}</td>
                <td>{stat.gasClaimsCountLabel}</td>
                <td>{stat.othersCountLabel}</td>
                <td>{stat.transactionsExcludingGasClaimsLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
};
