(() => {
  const { React, ReactDOM, htm } = window;
  if (!React || !ReactDOM || !htm) {
    return;
  }

  const html = htm.bind(React.createElement);
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  const data = window.__PAGE_DATA__ || {};
  const page = window.__PAGE__ || "dashboard";

  if (page === "dashboard" && data.chartData) {
    window.__DASHBOARD__ = data.chartData;
  }

  const navClass = (isActive) => (isActive ? "nav-link is-active" : "nav-link");

  const Navbar = ({ nav = {} }) => html`
    <nav class="navbar" data-animate style="--delay: 0s;">
      <a class="nav-brand" href="/dashboard">
        <span class="nav-mark">N3</span>
        <span class="nav-copy">
          <span class="nav-title">Neo Analytics</span>
        </span>
      </a>
      <div class="nav-links">
        <a class=${navClass(nav.dashboard)} href="/dashboard">Dashboard</a>
        <a class=${navClass(nav.faq)} href="/faq">FAQ</a>
        <a class=${navClass(nav.specialThanks)} href="/special-thanks">Special thanks</a>
      </div>
    </nav>
  `;

  const DashboardPage = () => {
    const totals = data.totals || {};
    const rangeFrom = data.rangeFrom || "";
    const rangeTo = data.rangeTo || "";
    const rangeLabel = data.rangeLabel || "";
    const topSenders = Array.isArray(data.topSenders) ? data.topSenders : [];
    const topReceivers = Array.isArray(data.topReceivers) ? data.topReceivers : [];

    return html`
      <main class="container">
        <${Navbar} nav=${data.nav} />
        <section class="summary-section">
          <div class="summary-header" data-animate style="--delay: 0.02s;">
            <div>
              <h2>Yesterday stats</h2>
            </div>
            ${rangeTo ? html`<span class="range-pill">${rangeTo}</span>` : null}
          </div>
          <div class="summary-grid">
            <div class="card accent" data-animate style="--delay: 0.05s;">
              <span>Transactions</span>
              <strong>${totals.totalTxs}</strong>
            </div>
            <div class="card" data-animate style="--delay: 0.1s;">
              <span>Transactions excluding Gas Claims</span>
              <strong>${totals.realUsage}</strong>
              <small>Swaps + transfers</small>
            </div>
            <div class="card" data-animate style="--delay: 0.15s;">
              <span>Active addresses</span>
              <strong>${totals.activeAddresses}</strong>
              <small>Unique senders + receivers</small>
            </div>
            <div class="card" data-animate style="--delay: 0.2s;">
              <span>NEO volume</span>
              <strong>${totals.neoVolume} NEO</strong>
            </div>
            <div class="card" data-animate style="--delay: 0.25s;">
              <span>GAS volume</span>
              <strong>${totals.gasVolume} GAS</strong>
            </div>
            <div class="card" data-animate style="--delay: 0.35s;">
              <span>Blocks scanned</span>
              <strong>${totals.blocks}</strong>
            </div>
          </div>
        </section>

        <section class="range-analytics-section">
          <div class="range-analytics-header" data-animate style="--delay: 0.32s;">
            <div>
              <h2>Range analytics</h2>
              <p class="summary-subtitle">Charts reflect the selected range.</p>
            </div>
            <div class="hero-links">
              <a
                class="button secondary"
                href="/days?from=${rangeFrom}&to=${rangeTo}"
              >
                Daily table
              </a>
              <span class="pill">${rangeLabel}</span>
            </div>
          </div>
          <form class="range-form" method="get" data-animate style="--delay: 0.34s;">
            <label>
              From
              <input type="date" name="from" value=${rangeFrom} />
            </label>
            <label>
              To
              <input type="date" name="to" value=${rangeTo} />
            </label>
            <button class="button" type="submit">Apply</button>
          </form>
        </section>

        <section class="chart-grid">
          <div class="chart-card wide" data-animate style="--delay: 0.05s;">
            <div class="chart-title">
              <h3>Total transactions</h3>
              <span>Per day (range)</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-total-txs" class="chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-card tall" data-animate style="--delay: 0.1s;">
            <div class="chart-title">
              <h3>Mix by type</h3>
              <span>Per day (range)</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-types" class="chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-card" data-animate style="--delay: 0.12s;">
            <div class="chart-title">
              <h3>Total transactions excluding Gas Claims</h3>
              <span>Per day (range)</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-real-usage" class="chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-card" data-animate style="--delay: 0.14s;">
            <div class="chart-title">
              <h3>Swaps</h3>
              <span>Per day (range)</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-swaps" class="chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-card" data-animate style="--delay: 0.15s;">
            <div class="chart-title">
              <h3>Active addresses</h3>
              <span>Per day (range)</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-addresses" class="chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-card" data-animate style="--delay: 0.2s;">
            <div class="chart-title">
              <h3>Transfer activity by asset</h3>
              <span>Top assets</span>
            </div>
            <div class="chart-area">
              <canvas id="chart-assets" class="chart-canvas"></canvas>
            </div>
          </div>
        </section>

        <section class="list-grid">
          <div class="list-card" data-animate style="--delay: 0.35s;">
            <h3>Top senders</h3>
            <ul>
              ${topSenders.map(
                (sender) => html`
                  <li>
                    <div>
                      <div class="mono">${sender.shortAddress}</div>
                      <small>${sender.address}</small>
                    </div>
                    <strong>${sender.transferCount}</strong>
                  </li>
                `,
              )}
            </ul>
          </div>
          <div class="list-card" data-animate style="--delay: 0.4s;">
            <h3>Top receivers</h3>
            <ul>
              ${topReceivers.map(
                (receiver) => html`
                  <li>
                    <div>
                      <div class="mono">${receiver.shortAddress}</div>
                      <small>${receiver.address}</small>
                    </div>
                    <strong>${receiver.transferCount}</strong>
                  </li>
                `,
              )}
            </ul>
          </div>
        </section>
      </main>
    `;
  };

  const DaysPage = () => {
    const stats = Array.isArray(data.stats) ? data.stats : [];
    const rangeFrom = data.rangeFrom || "";
    const rangeTo = data.rangeTo || "";

    return html`
      <main class="container">
        <${Navbar} nav=${data.nav} />

        <header class="hero" data-animate style="--delay: 0s;">
          <div>
            <h1>Neo Analytics</h1>
            <p class="subtitle">Daily activity table</p>
            <p class="hero-meta">
              Range: ${data.rangeLabel}. Browse daily stats and drill into a specific day.
            </p>
          </div>
          <div class="hero-actions">
            <form class="range-form" method="get">
              <label>
                From
                <input type="date" name="from" value=${rangeFrom} />
              </label>
              <label>
                To
                <input type="date" name="to" value=${rangeTo} />
              </label>
              <button class="button" type="submit">Apply</button>
            </form>
            <div class="hero-links">
              <a class="button secondary" href="/dashboard?from=${rangeFrom}&to=${rangeTo}">
                Back to dashboard
              </a>
              <span class="pill">${data.rangeLabel}</span>
            </div>
          </div>
        </header>

        <section class="table" data-animate style="--delay: 0.1s;">
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
              ${stats.map(
                (stat) => html`
                  <tr>
                    <td><a href="/day/${stat.dateLabel}">${stat.dateLabel}</a></td>
                    <td>${stat.totalTxCountLabel}</td>
                    <td>${stat.swapsCountLabel}</td>
                    <td>${stat.transfersCountLabel}</td>
                    <td>${stat.gasClaimsCountLabel}</td>
                    <td>${stat.othersCountLabel}</td>
                    <td>${stat.realUsageTotalLabel}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </section>
      </main>
    `;
  };

  const DayPage = () => {
    const stat = data.stat;
    const assetStats = Array.isArray(data.assetStats) ? data.assetStats : [];
    const methodStats = Array.isArray(data.methodStats) ? data.methodStats : [];
    const contractStats = Array.isArray(data.contractStats) ? data.contractStats : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];

    return html`
      <main class="container">
        <${Navbar} nav=${data.nav} />

        <header class="hero" data-animate style="--delay: 0s;">
          <div>
            <h1>Neo Analytics</h1>
            <p class="subtitle">Day details: ${data.date}</p>
            <p class="hero-meta">Classified transactions and breakdowns for the selected day.</p>
          </div>
          <div class="hero-actions">
            <a href="/dashboard" class="button">Back to dashboard</a>
          </div>
        </header>

        ${stat
          ? html`
              <section class="summary-grid">
                <div class="card accent" data-animate style="--delay: 0.05s;">
                  <span>Total transactions</span>
                  <strong>${stat.totalTxCount}</strong>
                  <small>All scanned blocks</small>
                </div>
                <div class="card" data-animate style="--delay: 0.1s;">
                  <span>Total transactions excluding Gas Claims</span>
                  <strong>${stat.realUsageTotal}</strong>
                  <small>Swaps + transfers</small>
                </div>
                <div class="card" data-animate style="--delay: 0.15s;">
                  <span>Active addresses</span>
                  <strong>${stat.uniqueAddresses}</strong>
                  <small>Unique senders + receivers</small>
                </div>
                <div class="card" data-animate style="--delay: 0.2s;">
                  <span>NEO volume</span>
                  <strong>${stat.neoVolume} NEO</strong>
                </div>
                <div class="card" data-animate style="--delay: 0.25s;">
                  <span>GAS volume</span>
                  <strong>${stat.gasVolume} GAS</strong>
                </div>
                <div class="card" data-animate style="--delay: 0.3s;">
                  <span>Others</span>
                  <strong>${stat.othersCount}</strong>
                  <small>Ignored or uncategorized</small>
                </div>
                <div class="card" data-animate style="--delay: 0.35s;">
                  <span>Blocks scanned</span>
                  <strong>${stat.blockCount}</strong>
                  <small>Daily total</small>
                </div>
              </section>
            `
          : html`<p>No stats found for this day.</p>`}

        <section class="list-grid">
          <div class="list-card" data-animate style="--delay: 0.35s;">
            <h3>Asset breakdown</h3>
            <ul>
              ${assetStats.map(
                (asset) => html`
                  <li>
                    <div>
                      <div class="mono">${asset.assetLabel}</div>
                      <small>${asset.transferCount} transfers</small>
                    </div>
                    <strong>${asset.volumeLabel}</strong>
                  </li>
                `,
              )}
            </ul>
          </div>
          <div class="list-card" data-animate style="--delay: 0.4s;">
            <h3>Top methods</h3>
            <ul>
              ${methodStats.map(
                (method) => html`
                  <li>
                    <div class="mono">${method.method}</div>
                    <strong>${method.txCount}</strong>
                  </li>
                `,
              )}
            </ul>
          </div>
          <div class="list-card" data-animate style="--delay: 0.45s;">
            <h3>Top contracts</h3>
            <ul>
              ${contractStats.map(
                (contract) => html`
                  <li>
                    <div class="mono">${contract.contract}</div>
                    <strong>${contract.txCount}</strong>
                  </li>
                `,
              )}
            </ul>
          </div>
        </section>

        <section class="table" data-animate style="--delay: 0.5s;">
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
              ${transactions.map(
                (tx) => html`
                  <tr>
                    <td>${tx.timestampLabel}</td>
                    <td class="mono">${tx.shortTxid}</td>
                    <td>${tx.type}</td>
                    <td class="mono">${tx.assetLabel}</td>
                    <td>${tx.amountLabel}</td>
                    <td class="mono">${tx.from}</td>
                    <td class="mono">${tx.to}</td>
                    <td class="mono">${tx.method}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </section>
      </main>
    `;
  };

  const FaqPage = () => html`
    <main class="container">
      <${Navbar} nav=${data.nav} />

      <header class="hero faq-hero" data-animate style="--delay: 0.04s;">
        <div>
          <span class="pill">FAQ</span>
          <h1>Clear answers to how Neo Analytics works.</h1>
          <p class="subtitle">
            We translate on-chain activity into a simple picture of Neo N3 activity,
            with transparent rules and daily updates.
          </p>
          <div class="hero-meta">
            <span class="pill">Neo N3 RPC data</span>
            <span class="pill">Daily ingestion</span>
            <span class="pill">Deterministic rules</span>
          </div>
        </div>
        <div class="faq-hero-card">
          <div class="faq-stat">
            <span class="faq-label">Support</span>
            <strong>Want to support this project?</strong>
            <p>
              This project is not funded by any organization. I cover the server costs and spend
              my own time to keep it running. If you want to support it, Neo/GAS or any N3 token
              donations to <span class="mono">NgdZvkR3bvsXuScWFrTQWfNhALarQ76CEr</span> are
              appreciated.
            </p>
          </div>
        </div>
      </header>

      <section class="faq-accordion" data-animate style="--delay: 0.12s;">
        <div class="faq-accordion-header">
          <h2>FAQ</h2>
          <p class="summary-subtitle">Short answers for deeper dives.</p>
        </div>
        <div class="faq-stack">
          <details open>
            <summary>How often is data updated?</summary>
            <p>
              The ingestion job runs daily at 00:30 UTC, processing all blocks from the previous
              day. Data is typically available within half an hour of completion.
            </p>
          </details>
          <details>
            <summary>Can I query the raw data?</summary>
            <p>
              Use the API endpoints under <span class="mono">/api/stats</span> for totals, asset
              stats, methods, and contract breakdowns. Swagger docs are available at
              <a href="/api/docs" class="mono">/api/docs</a>.
            </p>
          </details>
          <details>
            <summary>How is a transaction detected as a swap?</summary>
            <p>
              Swaps are detected when swap-like methods are called and there are multiple
              transfers, or when known DEX contracts and swap notifications are present.
            </p>
          </details>
          <details>
            <summary>Is this open source?</summary>
            <p>The codebase is maintained privately for now.</p>
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
              Yes. Reach out on
              <a href="https://github.com/ethArek" target="_blank" rel="noreferrer">
                github.com/ethArek
              </a>
              to suggest new metrics or features. Feedback is always welcome.
            </p>
          </details>
        </div>
      </section>

      <section class="faq-cta" data-animate style="--delay: 0.16s;">
        <div>
          <span class="range-caption">Ready to explore</span>
          <h2>Open the analytics dashboard</h2>
          <p class="summary-subtitle">Filter by date range and drill into daily details.</p>
        </div>
        <a class="button" href="/dashboard">Open dashboard</a>
      </section>
    </main>
  `;

  const SpecialThanksPage = () => html`
    <main class="container">
      <${Navbar} nav=${data.nav} />

      <header class="hero" data-animate style="--delay: 0s;">
        <div>
          <h1>Special thanks</h1>
          <p class="subtitle">
            A longer thank-you to the teams, builders, and community members who keep Neo N3
            moving.
          </p>
        </div>
      </header>

      <section class="list-grid">
        <div class="list-card" data-animate style="--delay: 0.1s;">
          <h3>City of Zion (CoZ)</h3>
          <p>
            Deep thanks to
            <a href="https://github.com/CityOfZion" target="_blank" rel="noreferrer">
              CityOfZion
            </a>
            for providing the
            <a
              href="https://www.npmjs.com/package/@cityofzion/neon-js"
              target="_blank"
              rel="noreferrer"
            >
              neon-js
            </a>
            SDK and the public
            <a href="https://dora.coz.io/monitor" target="_blank" rel="noreferrer">
              Nodes monitor
            </a>
            that made this project possible. These tools are the backbone for querying, decoding,
            and summarizing Neo N3 activity in a reliable way.
          </p>
          <p>
            The daily ingestion pipeline and classification rules depend on that steady foundation,
            and it is hugely appreciated.
          </p>
        </div>
        <div class="list-card" data-animate style="--delay: 0.15s;">
          <h3>Neo builders</h3>
          <p>
            Special thanks to every Neo builder who cares about the Neo N3 chain. Wallet teams,
            explorers, indexers, infra maintainers, and dApp authors keep the ecosystem visible,
            usable, and moving forward.
          </p>
          <p>
            We are still waiting for the one killer dApp that will drive mass adoption, but every
            contribution matters
          </p>
        </div>
      </section>
    </main>
  `;

  const AdminPage = () => html`
    <main class="container">
      <header class="hero" data-animate style="--delay: 0s;">
        <div>
          <h1>Admin console</h1>
          <p class="subtitle">Trigger manual ingestion runs for Neo N3.</p>
          <div class="hero-meta">
            Signed in as <span class="mono">${data.email}</span>
          </div>
        </div>
        <div class="hero-actions">
          <a class="button secondary" href="/dashboard">View dashboard</a>
          <form method="post" action="/admin/logout">
            <button class="button secondary" type="submit">Log out</button>
          </form>
        </div>
      </header>

      <section class="summary-section" data-animate style="--delay: 0.1s;">
        <div class="summary-header">
          <h2>Manual ingestion</h2>
        </div>
        ${data.message ? html`<p class="form-success">${data.message}</p>` : null}
        ${data.error ? html`<p class="form-error">${data.error}</p>` : null}
        <form class="form-grid" method="post" action="/admin/ingest">
          <label>
            Date (YYYY-MM-DD)
            <input type="date" name="date" value=${data.defaultDate || ""} />
          </label>
          <div class="form-actions">
            <button class="button" type="submit">Run ingestion</button>
          </div>
        </form>
      </section>
    </main>
  `;

  const AdminLoginPage = () => html`
    <main class="container">
      <header class="hero" data-animate style="--delay: 0s;">
        <div>
          <h1>Admin access</h1>
          <p class="subtitle">Sign in to manage ingestion runs.</p>
        </div>
        <div class="hero-actions">
          <a class="button secondary" href="/dashboard">Back to dashboard</a>
        </div>
      </header>

      <section class="summary-section" data-animate style="--delay: 0.1s;">
        <div class="summary-header">
          <h2>Log in</h2>
        </div>
        ${data.error ? html`<p class="form-error">${data.error}</p>` : null}
        <form class="form-grid" method="post" action="/admin/login">
          <label>
            Email
            <input type="email" name="email" value=${data.email || ""} required />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <div class="form-actions">
            <button class="button" type="submit">Log in</button>
          </div>
        </form>
      </section>
    </main>
  `;

  const pages = {
    dashboard: DashboardPage,
    days: DaysPage,
    day: DayPage,
    faq: FaqPage,
    "special-thanks": SpecialThanksPage,
    admin: AdminPage,
    "admin-login": AdminLoginPage,
  };

  const PageComponent = pages[page] || (() => html`<main class="container"></main>`);
  ReactDOM.createRoot(root).render(html`<${PageComponent} />`);
})();
