# Neo Analytics

Neo Analytics is a NestJS + React (Vite) dashboard that tracks Neo N3 daily activity and classifies transactions into swaps, oracle transactions, gas claims, transfers, or ignored (self/zero). It provides a public-facing dashboard, a JSON API for analytics, and admin endpoints for running ingestion jobs.

## Project overview

- **Data ingestion**: Pulls Neo N3 block data via Dora REST API, extracts NEP-17 transfer activity, and stores per-transaction/per-transfer records plus daily aggregates in PostgreSQL (via Prisma).
- **Classification**: Deterministic rules classify transactions into swaps, oracle transactions, gas claims, transfers, or ignored (self/zero), using swap method allowlists, known swap contracts, oracle/data-feed notifications, and DEX notifications.
- **Presentation**: NestJS renders the HTML shell + page data, React (Vite) hydrates the UI, and a JSON API exposes analytics for external consumers.

## Metric definitions

- **Transactions excluding GAS claims**: `total transactions - GAS claims`
- **Oracle transactions**: Detected oracle/data-feed traffic, included in total transactions and transactions excluding GAS claims, and tracked separately from transfers and ignored transactions
- **Others**: Ignored transactions only (currently self-transfers and zero-amount transfers)

## Architecture

```mermaid
flowchart LR
  subgraph "External Services"
    Dora["Dora REST API"]
    CoinPaprika["Coinpaprika API"]
    Flamingo["Flamingo price API"]
  end

  subgraph "NestJS Application"
    Cron["Cron schedules"]
    NeoClient["RpcNeoClient"]
    Ingest["IngestionService"]
    Classifier["Transaction classifier"]
    Stats["StatsService"]
    TokenSvc["TokenPerformanceService"]
    Liquidity["DefiLiquidityService"]
    Web["WebController"]
    Admin["AdminController"]
    API["ApiController"]
    Common["Shared utils + types"]
  end

  DB[("PostgreSQL via Prisma")]
  UI["React (Vite) pages"]
  Consumers["External consumers"]

  Dora -->|REST| NeoClient
  Cron --> Ingest
  NeoClient --> Ingest
  Ingest --> Classifier
  Classifier --> Ingest
  Ingest -->|transactions + aggregates| DB
  DB --> Stats
  Stats --> Web
  Stats --> API
  Admin -->|manual ingest/backfill| Ingest
  Common --> NeoClient
  Common --> Ingest
  Common --> Stats
  Common --> TokenSvc
  Common --> Liquidity
  CoinPaprika -->|latest NEO/GAS navbar prices| TokenSvc
  Flamingo -->|token performance windows| TokenSvc
  Flamingo -->|tracked liquidity pricing| Liquidity
  Flamingo -->|historical swap USD pricing| Ingest
  TokenSvc --> Web
  TokenSvc --> Admin
  Liquidity --> Web
  Web -->|HTML shell + window.__PAGE_DATA__| UI
  Admin -->|HTML shell + window.__PAGE_DATA__| UI
  API -->|JSON| Consumers
```

Public and admin pages are server-rendered by NestJS and hydrated from `window.__PAGE_DATA__`. The
latest NEO/GAS navbar ticker comes from Coinpaprika, while Flamingo is still used for DeFi token
performance windows, tracked liquidity pricing, and historical swap USD pricing.

## Requirements

- Node.js 18+
- PostgreSQL database

## Environment variables

```bash
NEO_DATABASE_URL="postgresql://user:password@localhost:5432/neo_usage"
SITE_URL="https://example.com"
NEO_NETWORK=MainNet
DORA_API_URL="https://api.coz.io"
COINPAPRIKA_API_URL="https://api.coinpaprika.com/v1"
FLAMINGO_PRICE_API_URL="https://neo-api.b-cdn.net/flamingo/live-data/prices/latest"
DEFI_METRICS_AVAILABLE_FROM="2026-03-07"
ADMIN_TOKEN="change-me"
```

`SITE_URL` is the public base URL used for canonical tags, `robots.txt`, and `sitemap.xml`. If it is
not set, the app falls back to the request host headers.

`COINPAPRIKA_API_URL` is used for the latest NEO/GAS prices shown at the top of pages. `FLAMINGO_PRICE_API_URL`
is still used for token performance windows and historical swap USD pricing.

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables (copy the block above into your shell or a local `.env` file, or start from `.env.example`).
3. Generate Prisma client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the development server:

   ```bash
   npm run start:dev
   ```

## Running

```bash
npm run start:dev
```

For React development with hot reload, run the Vite dev server in another terminal and set `VITE_DEV_SERVER_URL`
(for example `http://localhost:5173`) so the server renders the Vite scripts.

```bash
npm run dev:client
```

Visit http://localhost:3000/dashboard to see the dashboard.
The separate DeFi metrics page is available at http://localhost:3000/defi.
The FAQ is available at http://localhost:3000/faq.
Swagger docs are available at http://localhost:3000/api/docs (stats endpoints only).

Crawler-facing endpoints are also available:

- `GET /robots.txt`
- `GET /sitemap.xml`
- `GET /llms.txt`
- `GET /agents.txt`

The dashboard and DeFi page support date range filters via `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
The DeFi page intentionally starts at `DEFI_METRICS_AVAILABLE_FROM` and does not backfill earlier periods.

## CSV export

Export the same Dora-fetched transactions used by the swap/oracle/transfer/gas-claim classifier for a UTC day:

```bash
npm run export:dora-csv -- 2026-02-18
```

This command runs `scripts/export-dora-transactions-csv.js`.

The exporter:

- fetches transactions directly from Dora
- classifies them with the same rules as ingestion
- writes a CSV to `exports/dora-transactions-YYYY-MM-DD.csv` by default
- prints progress while scanning blocks so long full-day runs are visible in the terminal
- prints a final type summary for `SWAP`, `ORACLE`, `TRANSFER`, `GAS_CLAIM`, and `IGNORED`

You can override the output path with `--out path/to/file.csv`.

For shorter verification runs, you can also export a UTC time window:

```bash
npm run export:dora-csv -- --from 2026-03-13T00:00:00Z --to 2026-03-13T00:10:00Z
```

Example with a custom output file:

```bash
npm run export:dora-csv -- --from 2026-03-13T00:00:00Z --to 2026-03-13T00:10:00Z --out exports/oracle-sample.csv
```

The CSV is intended for auditing classification decisions and includes fields such as:

- transaction type
- classification reason
- transfer count
- invocation method and contract
- notification names and notification contracts
- serialized transfer list

Full UTC day exports can take a while because the script scans the relevant Dora block range and fetches
application logs for classification.

## Build + deployment

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
npm run start
```

The build outputs the React client bundle to `public/app` and the NestJS server serves it using the Vite
manifest. Ensure the `public/app` directory is deployed alongside the server bundle.

If you want to serve a prebuilt client bundle from a different host or CDN (or run the Vite dev server),
set `VITE_DEV_SERVER_URL` to point at the host URL so the server renders the correct script tags.

## Classification rules

Classification is handled in `src/classifier/classifier.ts` and is deterministic.

- **Swap**
  - A transaction is classified as a swap if any of these match:
    1. Invocation targets a known swap contract allowlist.
    2. Invocation method is in the swap method allowlist (e.g. `swap`, `swapToken`, `swapTokens`, `swapExactTokens`, `swapTokensForExactTokens`, `swapExactTokensForTokens`) **and** there are 2+ transfers.
    3. Application log notifications include a known swap contract or DEX-style event names (e.g. `Swapped`, `OrderUpdated`, `OrderUpserted`).
- **Gas claim**
  - Gas claims are detected based on transaction data: GAS transfers with no `from` address (or an empty `from` field).
  - This pattern indicates GAS being distributed from the system to a user, which is characteristic of gas claim operations in Neo N3.
  - GAS transfers with a valid `from` address are classified as transfers.
- **Oracle**
  - Oracle transactions are detected from known oracle/data-feed contracts and oracle-style notifications (for example `FeedUpdated`, `OracleRequested`, and `OracleFulfilled`).
  - These transactions are tracked separately from transfers so contract maintenance traffic does not look like user transfer activity.
- **Transfer**
  - Transfers that are not swaps, oracle transactions, or gas claims and are not filtered out as ignored.
- **Ignored**
  - Self-transfers (`from == to`) are excluded from totals.
  - Zero-amount transfers are ignored if an amount is provided.

Precedence order: **swap > oracle > gas claim > ignored > transfer**.

If you want previously ingested days to show oracle counts separately, rebuild those days after deploying the
oracle classification changes.

## Neo data provider

The provider is abstracted behind the `NeoClient` interface (`src/neo-client/neo-client.interface.ts`).
The implementation uses Dora REST endpoints to scan blocks by date and extract NEP-17 `Transfer`
notifications for transactions (`src/neo-client/neo-client.service.ts`).

It relies on:

- `height`
- `block`
- `log`
- `asset`
- `contract`

## Analytics API

- `GET /api/stats` (latest 30 days) or `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/stats/summary` (totals for range)
- `GET /api/stats/assets` (asset transfer breakdown)
- `GET /api/stats/methods` (top invocation methods)
- `GET /api/stats/contracts` (top contracts)
- `GET /api/stats/top` with `type=senders|receivers`

Stats responses include daily counters such as `swapsCount`, `oracleCount`, `transfersCount`,
`gasClaimsCount`, `othersCount`, and `transactionsExcludingGasClaims`.

## Admin job endpoints

- `POST /api/jobs/run` with optional `{ "date": "YYYY-MM-DD" }`.
- `POST /api/jobs/rebuild` with `{ "date": "YYYY-MM-DD" }` and `x-admin-token` header.
- `POST /api/jobs/backfill` with `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }` and `x-admin-token` header.
- `POST /api/jobs/backfill-last-30` with `x-admin-token` header (ingests yesterday + previous 29 days).
- `POST /api/jobs/backfill-swap-usd` with `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }` and `x-admin-token` header (recomputes swap USD values for already ingested days using Flamingo historical pricing).
- `POST /api/jobs/backfill-10-minutes` with optional `{ "from": "YYYY-MM-DDTHH:mm:ssZ" }` and `x-admin-token` header (defaults to last 10 minutes).

## Admin UI

- `GET /admin/login` shows the login form.
- `GET /admin` shows the ingestion console for triggering manual ingestion runs.
- `POST /admin/login` submits credentials and creates a session.
- `POST /admin/ingest` triggers ingestion for a given date (requires a valid session).
- `POST /admin/logout` clears the session cookie.

## Tests

```bash
npm run lint
npm run format
npm test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, testing guidance, and code style expectations.

## Security

Please review [SECURITY.md](SECURITY.md) for vulnerability reporting and disclosure guidance.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
