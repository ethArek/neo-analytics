import type React from 'react';
import { MarketTicker } from '../components/MarketTicker';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AdminData } from '../types';
import { delayStyle, getPageData } from '../utils';

export const AdminPage: React.FC = () => {
  const data = getPageData<AdminData>();

  return (
    <main className="container">
      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <h1>Admin console</h1>
          <p className="subtitle">Trigger manual ingestion runs for Neo N3.</p>
          <div className="hero-meta">
            Signed in as <span className="mono">{data.email}</span>
          </div>
        </div>
        <div className="hero-actions">
          <MarketTicker marketPrices={data.marketPrices} className="admin-market-ticker" />
          <ThemeToggle />
          <a className="button secondary" href="/dashboard">
            View dashboard
          </a>
          <form method="post" action="/admin/logout">
            <button className="button secondary" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>

      <section className="summary-section" data-animate style={delayStyle('0.1s')}>
        <div className="summary-header">
          <h2>Manual ingestion</h2>
        </div>
        {data.message ? <p className="form-success">{data.message}</p> : null}
        {data.error ? <p className="form-error">{data.error}</p> : null}
        <form className="form-grid" method="post" action="/admin/ingest">
          <label>
            Date (YYYY-MM-DD)
            <input type="date" name="date" defaultValue={data.defaultDate ?? ''} />
          </label>
          <div className="form-actions">
            <button className="button" type="submit">
              Run ingestion
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};
