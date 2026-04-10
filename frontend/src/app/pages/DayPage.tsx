import type React from 'react';
import { Navbar } from '../components/Navbar';
import { delayStyle, ensureArray, getPageData } from '../utils';
import type { DayData, DayPagination, DayTransaction } from '../types';

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const PAGE_WINDOW_RADIUS = 2;

const buildDayHref = (date: string, page: number, pageSize: number): string => {
  if (!date) {
    return '/days';
  }

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  return `/day/${encodeURIComponent(date)}?${params.toString()}`;
};

const formatCount = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
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

const fallbackPagination = (transactions: DayTransaction[]): DayPagination => {
  const totalItems = transactions.length;

  return {
    page: 1,
    pageSize: Math.max(totalItems, 1),
    totalItems,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
  };
};

const buildPageWindow = (page: number, totalPages: number): number[] => {
  const min = Math.max(1, page - PAGE_WINDOW_RADIUS);
  const max = Math.min(totalPages, page + PAGE_WINDOW_RADIUS);
  const pages: number[] = [];

  for (let current = min; current <= max; current += 1) {
    pages.push(current);
  }

  return pages;
};

export const DayPage: React.FC = () => {
  const data = getPageData<DayData>();
  const date = data.date ?? '';
  const stat = data.stat ?? null;
  const assetStats = ensureArray(data.assetStats);
  const transactions = ensureArray(data.transactions);
  const pagination = data.pagination ?? fallbackPagination(transactions);
  const pageSizeOptions: number[] =
    Array.isArray(pagination.pageSizeOptions) && pagination.pageSizeOptions.length > 0
      ? pagination.pageSizeOptions
      : DEFAULT_PAGE_SIZE_OPTIONS;
  const totalItems = pagination.totalItems;
  const startItem = totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(totalItems, startItem + transactions.length - 1);
  const pageWindow = buildPageWindow(pagination.page, pagination.totalPages);
  const firstPageHref = buildDayHref(date, 1, pagination.pageSize);
  const previousPageHref = buildDayHref(date, pagination.page - 1, pagination.pageSize);
  const nextPageHref = buildDayHref(date, pagination.page + 1, pagination.pageSize);
  const lastPageHref = buildDayHref(date, pagination.totalPages, pagination.pageSize);

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <h1>Neo Analytics</h1>
          <p className="subtitle">Day details: {date}</p>
          <p className="hero-meta">Classified transactions and breakdowns for the selected day.</p>
        </div>
        <div className="hero-actions">
          <a href="/dashboard" className="button">
            Back to dashboard
          </a>
          <a href="/days" className="button secondary">
            Open daily table
          </a>
        </div>
      </header>

      {stat ? (
        <section className="summary-grid">
          <div className="card accent" data-animate style={delayStyle('0.05s')}>
            <span>Total transactions</span>
            <strong>{stat.totalTxCount}</strong>
            <small>All scanned blocks</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.1s')}>
            <span>Transactions excluding GAS claims</span>
            <strong>{stat.transactionsExcludingGasClaims}</strong>
            <small>Total transactions - GAS claims</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.15s')}>
            <span>Oracle transactions (subset)</span>
            <strong>{stat.oracleCount}</strong>
            <small>Included in transactions excluding GAS claims</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.2s')}>
            <span>Active addresses</span>
            <strong>{stat.uniqueAddresses}</strong>
            <small>Unique senders + receivers</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.25s')}>
            <span>NEO volume</span>
            <strong>{stat.neoVolume} NEO</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.3s')}>
            <span>GAS volume</span>
            <strong>{stat.gasVolume} GAS</strong>
          </div>
          <div className="card" data-animate style={delayStyle('0.35s')}>
            <span>Others</span>
            <strong>{stat.othersCount}</strong>
            <small>Ignored transactions only</small>
          </div>
          <div className="card" data-animate style={delayStyle('0.4s')}>
            <span>Blocks scanned</span>
            <strong>{stat.blockCount}</strong>
            <small>Daily total</small>
          </div>
        </section>
      ) : (
        <p>No stats found for this day.</p>
      )}

      <section className="list-grid">
        <div className="list-card" data-animate style={delayStyle('0.35s')}>
          <h3>Asset transfer volume</h3>
          <ul className="asset-breakdown-list">
            {assetStats.map((asset) => (
              <li key={asset.assetLabel}>
                <div>
                  {asset.assetHref ? (
                    <a className="mono" href={asset.assetHref}>
                      {asset.assetLabel}
                    </a>
                  ) : (
                    <span className="mono">{asset.assetLabel}</span>
                  )}{' '}
                  <small>{asset.transferCount} transfers</small>
                </div>
                <strong>{asset.volumeLabel}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="table day-table" data-animate style={delayStyle('0.5s')}>
        <div className="table-toolbar">
          <div>
            <h3>Transaction explorer</h3>
            <p className="summary-subtitle">
              Showing {formatCount(startItem)}-{formatCount(endItem)} of {formatCount(totalItems)}{' '}
              transactions
            </p>
          </div>
          <form className="pager-form" method="get">
            <input type="hidden" name="page" value="1" />
            <label>
              Rows
              <select name="pageSize" defaultValue={String(pagination.pageSize)}>
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              Apply
            </button>
          </form>
        </div>
        <div className="table-scroll">
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
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8}>No transactions found for this page.</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.txid ?? `${tx.shortTxid}-${tx.timestampLabel}`}>
                    <td>{tx.timestampLabel}</td>
                    <td className="mono" title={tx.txid ?? tx.shortTxid}>
                      {tx.shortTxid}
                    </td>
                    <td>{tx.type}</td>
                    <td className="mono">{tx.assetLabel}</td>
                    <td>{tx.amountLabel}</td>
                    <td className="mono">{normalizeNullable(tx.from)}</td>
                    <td className="mono">{normalizeNullable(tx.to)}</td>
                    <td className="mono">{normalizeNullable(tx.method)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination-bar">
          <span className="summary-subtitle">
            Page {formatCount(pagination.page)} of {formatCount(pagination.totalPages)}
          </span>
          <nav className="pagination-links" aria-label="Transactions pagination">
            {pagination.hasPreviousPage ? (
              <>
                <a className="button secondary pagination-link" href={firstPageHref}>
                  First
                </a>
                <a className="button secondary pagination-link" href={previousPageHref}>
                  Previous
                </a>
              </>
            ) : (
              <>
                <span className="button secondary pagination-link is-disabled">First</span>
                <span className="button secondary pagination-link is-disabled">Previous</span>
              </>
            )}
            {pageWindow.map((pageNumber) => (
              <a
                key={pageNumber}
                className={`button secondary pagination-link ${
                  pageNumber === pagination.page ? 'is-current' : ''
                }`}
                href={buildDayHref(date, pageNumber, pagination.pageSize)}
                aria-current={pageNumber === pagination.page ? 'page' : undefined}
              >
                {pageNumber}
              </a>
            ))}
            {pagination.hasNextPage ? (
              <>
                <a className="button secondary pagination-link" href={nextPageHref}>
                  Next
                </a>
                <a className="button secondary pagination-link" href={lastPageHref}>
                  Last
                </a>
              </>
            ) : (
              <>
                <span className="button secondary pagination-link is-disabled">Next</span>
                <span className="button secondary pagination-link is-disabled">Last</span>
              </>
            )}
          </nav>
        </div>
      </section>
    </main>
  );
};
