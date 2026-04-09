import type React from 'react';
import { Navbar } from '../components/Navbar';
import { delayStyle, getPageData } from '../utils';
import type { DashboardData } from '../types';

export const FaqPage: React.FC = () => {
  const data = getPageData<DashboardData>();

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} />

      <header className="hero faq-hero" data-animate style={delayStyle('0.04s')}>
        <div>
          <span className="pill">FAQ</span>
          <h1>Clear answers to how Neo Analytics works.</h1>
          <p className="subtitle">
            We translate on-chain activity into a simple picture of Neo N3 activity, with
            transparent rules and daily updates.
          </p>
          <div className="hero-meta">
            <span className="pill">Neo N3 RPC data</span>
            <span className="pill">Daily ingestion</span>
            <span className="pill">Deterministic rules</span>
          </div>
        </div>
        <div className="faq-hero-card">
          <div className="faq-stat">
            <span className="faq-label">Support</span>
            <strong>Want to support this project?</strong>
            <p>
              This project is not funded by any organization. I cover the server costs and spend my
              own time to keep it running. If you want to support it, Neo/GAS or any N3 token
              donations to <span className="mono">NgdZvkR3bvsXuScWFrTQWfNhALarQ76CEr</span> are
              appreciated.
            </p>
          </div>
        </div>
      </header>

      <section className="faq-accordion" data-animate style={delayStyle('0.12s')}>
        <div className="faq-accordion-header">
          <h2>FAQ</h2>
          <p className="summary-subtitle">Short answers for deeper dives.</p>
        </div>
        <div className="faq-stack">
          <details open>
            <summary>How often is data updated?</summary>
            <p>
              The scheduled ingestion job runs daily at 01:10 in the Europe/Warsaw timezone and
              processes the previous UTC day. If the latest day is still missing, an hourly retry
              job keeps checking until ingestion completes.
            </p>
          </details>
          <details>
            <summary>Can I query the raw data?</summary>
            <p>
              Use the API endpoints under <span className="mono">/api/stats</span> for totals, asset
              stats, methods, and contract breakdowns. Swagger docs are available at{' '}
              <a href="/api/docs" className="mono">
                /api/docs
              </a>
              .
            </p>
          </details>
          <details>
            <summary>How is a transaction detected as a swap?</summary>
            <p>
              Swaps are detected when swap-like methods are called and there are multiple transfers,
              or when known DEX contracts and swap notifications are present.
            </p>
          </details>
          <details>
            <summary>Are DeFi metrics fully historical?</summary>
            <p>
              No. DeFi metrics live on their own page and begin on the published availability date
              for the current deployment. Earlier periods are intentionally not backfilled when the
              methodology would not match.
            </p>
          </details>
          <details>
            <summary>Is this open source?</summary>
            <p>Yes. The project source is published on GitHub together with setup instructions.</p>
          </details>
          <details>
            <summary>Do you store user data?</summary>
            <p>
              The app stores on-chain transaction summaries only. No personal data is collected
              beyond what is already public on-chain.
            </p>
          </details>
          <details>
            <summary>Can I request a new metric?</summary>
            <p>
              Yes. Reach out on{' '}
              <a href="https://github.com/ethArek" target="_blank" rel="noreferrer">
                github.com/ethArek
              </a>{' '}
              to suggest new metrics or features. Feedback is always welcome.
            </p>
          </details>
        </div>
      </section>

      <section className="faq-cta" data-animate style={delayStyle('0.16s')}>
        <div>
          <span className="range-caption">Ready to explore</span>
          <h2>Open the analytics dashboard</h2>
          <p className="summary-subtitle">Filter by date range and drill into daily details.</p>
        </div>
        <a className="button" href="/dashboard">
          Open dashboard
        </a>
      </section>
    </main>
  );
};
