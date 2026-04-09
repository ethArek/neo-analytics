import type React from 'react';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import type { AssetAddress, AssetData } from '../types';
import { buildPageHref, delayStyle, ensureArray, getPageData } from '../utils';

const formatTopAddressLabel = (shortAddress: string, addressLabel?: string): string => {
  if (!addressLabel) {
    return shortAddress;
  }

  return `${shortAddress} (${addressLabel})`;
};

const normalizeNullable = (value: string | null | undefined): string => {
  if (!value) {
    return '-';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '-';
  }

  return trimmed;
};

const AddressList: React.FC<{
  title: string;
  items: AssetAddress[];
  delay: string;
}> = ({ title, items, delay }) => {
  return (
    <div className="list-card" data-animate style={delayStyle(delay)}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="summary-subtitle">
          No address activity for this direction in the selected range.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.address}>
              <div>
                <div className="mono">
                  {formatTopAddressLabel(item.shortAddress, item.addressLabel)}
                </div>
                <small>{item.address}</small>
              </div>
              <div className="asset-address-value">
                <strong>{item.transferCount}</strong>
                <small>{item.volumeLabel}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AssetPage: React.FC = () => {
  const data = getPageData<AssetData>();
  const assetLabel = data.assetLabel ?? 'Asset';
  const assetId = data.assetId ?? '';
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? '';
  const summary = data.summary ?? null;
  const defiRelation = data.defiRelation ?? null;
  const typeBreakdown = ensureArray(data.typeBreakdown);
  const dailyActivity = ensureArray(data.dailyActivity);
  const topSenders = ensureArray(data.topSenders);
  const topReceivers = ensureArray(data.topReceivers);
  const recentTransactions = ensureArray(data.recentTransactions);
  const dashboardHref = buildPageHref('/dashboard', { from: rangeFrom, to: rangeTo });
  const daysHref = buildPageHref('/days', { from: rangeFrom, to: rangeTo });
  const hasActivityData =
    Boolean(summary) ||
    typeBreakdown.length > 0 ||
    topSenders.length > 0 ||
    topReceivers.length > 0 ||
    dailyActivity.length > 0 ||
    recentTransactions.length > 0;
  const hasDefiContext = Boolean(defiRelation);

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <span className="pill">Asset detail</span>
          <h1>{assetLabel}</h1>
          <p className="subtitle">
            Transfer volume, active addresses, transaction mix, and DeFi context for the selected
            asset.
          </p>
          <div className="hero-meta">
            {assetId ? <span className="mono">{assetId}</span> : null}
            {rangeLabel ? <span className="pill">{rangeLabel}</span> : null}
          </div>
        </div>
        <div className="hero-actions">
          <DateRangeForm from={rangeFrom} to={rangeTo} />
          <div className="hero-links">
            <a className="button secondary" href={dashboardHref}>
              Back to dashboard
            </a>
            <a className="button secondary" href={daysHref}>
              Daily table
            </a>
          </div>
        </div>
      </header>

      {summary ? (
        <section className="summary-grid">
          <div className="card accent" data-animate style={delayStyle('0.04s')}>
            <span>Total volume</span>
            <strong>{summary.volumeLabel}</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.08s')}>
            <span>Transfer count</span>
            <strong>{summary.transferCount}</strong>
            <small>{summary.txCount} transactions</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.12s')}>
            <span>Active addresses</span>
            <strong>{summary.activeAddresses}</strong>
            <small>
              {summary.uniqueSenders} senders · {summary.uniqueReceivers} receivers
            </small>
          </div>
          <div className="card" data-animate style={delayStyle('0.16s')}>
            <span>Swap share</span>
            <strong>{summary.swapShare}</strong>
            <small>{summary.swapsCount} swap transactions</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.2s')}>
            <span>Transfer share</span>
            <strong>{summary.transferShare}</strong>
            <small>{summary.transfersCount} transfer transactions</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.24s')}>
            <span>Other classifications</span>
            <strong>{summary.otherCount}</strong>
            <small>
              {summary.oracleCount} oracle · {summary.gasClaimsCount} GAS claims ·{' '}
              {summary.ignoredCount} ignored
            </small>
          </div>
        </section>
      ) : hasActivityData || hasDefiContext ? (
        <section className="empty-state" data-animate style={delayStyle('0.04s')}>
          <h2>No activity in the selected range</h2>
          <p>
            This asset has no indexed transfers in the selected dates yet. You can broaden the range
            or use the DeFi context below if the token is present in current Flamingo feeds.
          </p>
        </section>
      ) : null}

      {defiRelation ? (
        <section className="summary-section" data-animate style={delayStyle('0.28s')}>
          <div className="summary-header">
            <div>
              <h2>DeFi relation</h2>
              <p className="summary-subtitle">
                Current Flamingo pricing and tracked liquidity context for this asset.
              </p>
            </div>
            {defiRelation.stablecoin ? <span className="pill">Stablecoin</span> : null}
          </div>
          <div className="summary-grid">
            <div className="card accent">
              <span>Current Flamingo price</span>
              <strong>{defiRelation.currentPrice ?? '-'}</strong>
              <small>{defiRelation.marketSymbol}</small>
            </div>
            <div className="card">
              <span>24h change</span>
              <strong>{defiRelation.change24h ?? '-'}</strong>
            </div>
            <div className="card">
              <span>7 day change</span>
              <strong>{defiRelation.change7d ?? '-'}</strong>
            </div>
            <div className="card">
              <span>30 day change</span>
              <strong>{defiRelation.change30d ?? '-'}</strong>
            </div>
            <div className="card">
              <span>Tracked liquidity</span>
              <strong>{defiRelation.trackedLiquidityUsd ?? '-'}</strong>
              <small>
                {defiRelation.trackedLiquidityBalance
                  ? `${defiRelation.trackedLiquidityBalance} ${defiRelation.marketSymbol}`
                  : 'Not present in tracked liquidity snapshot'}
              </small>
            </div>
          </div>
          {!defiRelation.hasMarketPrice && !defiRelation.hasTrackedLiquidity ? (
            <p className="summary-subtitle">
              No live Flamingo market or tracked liquidity context is available for this asset right
              now.
            </p>
          ) : null}
        </section>
      ) : null}

      {hasActivityData ? (
        <>
          <section className="list-grid">
            <div className="list-card" data-animate style={delayStyle('0.32s')}>
              <h3>Activity mix</h3>
              {typeBreakdown.length === 0 ? (
                <p className="summary-subtitle">
                  No classified transactions for this asset in the selected range.
                </p>
              ) : (
                <ul className="asset-type-list">
                  {typeBreakdown.map((entry) => (
                    <li key={entry.key}>
                      <div>
                        <div>{entry.label}</div>
                        <small>{entry.share} of asset transactions</small>
                      </div>
                      <strong>{entry.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <AddressList title="Top senders" items={topSenders} delay="0.36s" />
            <AddressList title="Top receivers" items={topReceivers} delay="0.4s" />
          </section>

          <section className="table" data-animate style={delayStyle('0.44s')}>
            <div className="table-toolbar">
              <div>
                <h3>Daily activity</h3>
                <p className="summary-subtitle">Per-day view for the selected asset.</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transfers</th>
                  <th>Transactions</th>
                  <th>Unique senders</th>
                  <th>Unique receivers</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {dailyActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No daily activity for this asset in the selected range.</td>
                  </tr>
                ) : (
                  dailyActivity.map((row) => (
                    <tr key={row.dateLabel}>
                      <td>
                        <a href={row.dayHref}>{row.dateLabel}</a>
                      </td>
                      <td>{row.transferCount}</td>
                      <td>{row.txCount}</td>
                      <td>{row.uniqueSenders}</td>
                      <td>{row.uniqueReceivers}</td>
                      <td>{row.volumeLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="table" data-animate style={delayStyle('0.48s')}>
            <div className="table-toolbar">
              <div>
                <h3>Recent transactions</h3>
                <p className="summary-subtitle">
                  Latest indexed transactions that included this asset.
                </p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Txid</th>
                  <th>Type</th>
                  <th>Asset amount in tx</th>
                  <th>Transfers</th>
                  <th>Method</th>
                  <th>Day</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No recent transactions available for this asset.</td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => (
                    <tr key={transaction.txid}>
                      <td>{transaction.timestampLabel}</td>
                      <td className="mono" title={transaction.txid}>
                        {transaction.shortTxid}
                      </td>
                      <td>{transaction.type}</td>
                      <td>{transaction.amountLabel}</td>
                      <td>{transaction.transferCount}</td>
                      <td className="mono">{normalizeNullable(transaction.method)}</td>
                      <td>
                        <a href={transaction.dayHref}>{transaction.dayLabel}</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {!hasActivityData && !hasDefiContext ? (
        <section className="empty-state" data-animate style={delayStyle('0.52s')}>
          <h2>No indexed context for this asset yet</h2>
          <p>
            We could not find on-chain activity or DeFi metadata for this asset in the current
            dataset.
          </p>
        </section>
      ) : null}
    </main>
  );
};
