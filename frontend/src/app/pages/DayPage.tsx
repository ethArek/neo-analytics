import React from 'react';
import { Navbar } from '../components/Navbar';
import { ensureArray, getPageData } from '../utils';
import type { DayData } from '../types';

export const DayPage: React.FC = () => {
  const data = getPageData() as DayData;
  const stat = data.stat ?? null;
  const assetStats = ensureArray(data.assetStats);
  const methodStats = ensureArray(data.methodStats);
  const contractStats = ensureArray(data.contractStats);
  const transactions = ensureArray(data.transactions);

  return (
    <main className="container">
      <Navbar nav={data.nav} />

      <header className="hero" data-animate style={{ '--delay': '0s' } as React.CSSProperties}>
        <div>
          <h1>Neo Analytics</h1>
          <p className="subtitle">Day details: {data.date}</p>
          <p className="hero-meta">
            Classified transactions and breakdowns for the selected day.
          </p>
        </div>
        <div className="hero-actions">
          <a href="/dashboard" className="button">
            Back to dashboard
          </a>
        </div>
      </header>

      {stat ? (
        <section className="summary-grid">
          <div className="card accent" data-animate style={{ '--delay': '0.05s' } as React.CSSProperties}>
            <span>Total transactions</span>
            <strong>{stat.totalTxCount}</strong>
            <small>All scanned blocks</small>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.1s' } as React.CSSProperties}>
            <span>Total transactions excluding Gas Claims</span>
            <strong>{stat.realUsageTotal}</strong>
            <small>Swaps + transfers</small>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.15s' } as React.CSSProperties}>
            <span>Active addresses</span>
            <strong>{stat.uniqueAddresses}</strong>
            <small>Unique senders + receivers</small>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.2s' } as React.CSSProperties}>
            <span>NEO volume</span>
            <strong>{stat.neoVolume} NEO</strong>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.25s' } as React.CSSProperties}>
            <span>GAS volume</span>
            <strong>{stat.gasVolume} GAS</strong>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.3s' } as React.CSSProperties}>
            <span>Others</span>
            <strong>{stat.othersCount}</strong>
            <small>Ignored or uncategorized</small>
          </div>
          <div className="card" data-animate style={{ '--delay': '0.35s' } as React.CSSProperties}>
            <span>Blocks scanned</span>
            <strong>{stat.blockCount}</strong>
            <small>Daily total</small>
          </div>
        </section>
      ) : (
        <p>No stats found for this day.</p>
      )}

      <section className="list-grid">
        <div className="list-card" data-animate style={{ '--delay': '0.35s' } as React.CSSProperties}>
          <h3>Asset breakdown</h3>
          <ul>
            {assetStats.map((asset) => (
              <li key={asset.assetLabel}>
                <div>
                  <div className="mono">{asset.assetLabel}</div>
                  <small>{asset.transferCount} transfers</small>
                </div>
                <strong>{asset.volumeLabel}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="list-card" data-animate style={{ '--delay': '0.4s' } as React.CSSProperties}>
          <h3>Top methods</h3>
          <ul>
            {methodStats.map((method) => (
              <li key={method.method}>
                <div className="mono">{method.method}</div>
                <strong>{method.txCount}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="list-card" data-animate style={{ '--delay': '0.45s' } as React.CSSProperties}>
          <h3>Top contracts</h3>
          <ul>
            {contractStats.map((contract) => (
              <li key={contract.contract}>
                <div className="mono">{contract.contract}</div>
                <strong>{contract.txCount}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="table" data-animate style={{ '--delay': '0.5s' } as React.CSSProperties}>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Txid</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Amount</th>
              <th>From</th>
              <th>To</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.shortTxid}>
                <td>{tx.timestampLabel}</td>
                <td className="mono">{tx.shortTxid}</td>
                <td>{tx.type}</td>
                <td className="mono">{tx.assetLabel}</td>
                <td>{tx.amountLabel}</td>
                <td className="mono">{tx.from}</td>
                <td className="mono">{tx.to}</td>
                <td className="mono">{tx.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
};
