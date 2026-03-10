import type React from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AdminLoginData } from '../types';
import { delayStyle, getPageData } from '../utils';

export const AdminLoginPage: React.FC = () => {
  const data = getPageData<AdminLoginData>();

  return (
    <main className="container">
      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <h1>Admin access</h1>
          <p className="subtitle">Sign in to manage ingestion runs.</p>
        </div>
        <div className="hero-actions">
          <ThemeToggle />
          <a className="button secondary" href="/dashboard">
            Back to dashboard
          </a>
        </div>
      </header>

      <section className="summary-section" data-animate style={delayStyle('0.1s')}>
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
