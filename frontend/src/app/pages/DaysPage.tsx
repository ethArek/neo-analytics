import React from 'react';
import { Navbar } from '../components/Navbar';
import { ensureArray, getPageData } from '../utils';
import type { DaysData } from '../types';

export const DaysPage: React.FC = () => {
  const data = getPageData() as DaysData;
  const stats = ensureArray(data.stats);
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? '';

  return (
    <main className="container">
      <Navbar nav={data.nav} />

      <header className="hero" data-animate style={{ '--delay': '0s' } as React.CSSProperties}>
        <div>
          <h1>Neo Analytics</h1>
          <p className="subtitle">Daily activity table</p>
          <p className="hero-meta">
            Range: {rangeLabel}. Browse daily stats and drill into a specific day.
          </p>
        </div>
        <div className="hero-actions">
          <form className="range-form" method="get">
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
          <div className="hero-links">
            <a className="button secondary" href={`/dashboard?from=${rangeFrom}&to=${rangeTo}`}>
              Back to dashboard
            </a>
            <span className="pill">{rangeLabel}</span>
          </div>
        </div>
      </header>

      <section className="table" data-animate style={{ '--delay': '0.1s' } as React.CSSProperties}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Total txs</th>
              <th>Swaps</th>
              <th>Transfers</th>
              <th>Gas claims</th>
              <th>Others</th>
              <th>Total tx excluding Gas Claims</th>
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
                <td>{stat.transfersCountLabel}</td>
                <td>{stat.gasClaimsCountLabel}</td>
                <td>{stat.othersCountLabel}</td>
                <td>{stat.realUsageTotalLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
};
