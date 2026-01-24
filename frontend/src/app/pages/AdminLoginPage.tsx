import React from 'react';
import { getPageData } from '../utils';
import type { AdminLoginData } from '../types';

export const AdminLoginPage: React.FC = () => {
  const data = getPageData() as AdminLoginData;

  return (
    <main className="container">
      <header className="hero" data-animate style={{ '--delay': '0s' } as React.CSSProperties}>
        <div>
          <h1>Admin access</h1>
          <p className="subtitle">Sign in to manage ingestion runs.</p>
        </div>
        <div className="hero-actions">
          <a className="button secondary" href="/dashboard">
            Back to dashboard
          </a>
        </div>
      </header>

      <section className="summary-section" data-animate style={{ '--delay': '0.1s' } as React.CSSProperties}>
        <div className="summary-header">
          <h2>Log in</h2>
        </div>
        {data.error ? <p className="form-error">{data.error}</p> : null}
        <form className="form-grid" method="post" action="/admin/login">
          <label>
            Email
            <input type="email" name="email" defaultValue={data.email ?? ''} required />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <div className="form-actions">
            <button className="button" type="submit">
              Log in
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};
