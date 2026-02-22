# Neo Analytics

Neo Analytics is a NestJS + React (Vite) dashboard that tracks Neo N3 daily activity and classifies transactions into swaps, gas claims, normal transfers, or ignored (self/zero). It provides a public-facing dashboard, a JSON API for analytics, and admin endpoints for running ingestion jobs.

## Project overview

- **Data ingestion**: Pulls Neo N3 block data via Dora REST API, extracts NEP-17 transfer activity, and stores per-transaction/per-transfer records plus daily aggregates in PostgreSQL (via Prisma).
- **Classification**: Deterministic rules classify transactions into swaps, gas claims, normal transfers, or ignored (self/zero), using swap method allowlists, known swap contracts, and DEX notifications.
- **Presentation**: NestJS renders the HTML shell + page data, React (Vite) hydrates the UI, and a JSON API exposes analytics for external consumers.

## Architecture

```mermaid
flowchart LR
  Dora[Dora API endpoints] -->|REST| NeoClient[RpcNeoClient]
  NeoClient --> Ingest[IngestionService]
  Cron[Cron schedules] --> Ingest
  Admin[Admin UI + job API] -->|manual ingest/backfill| Ingest
  Ingest -->|transactions + aggregates| DB[(PostgreSQL)]
  DB --> Stats[StatsService]
  Stats --> Web["WebController HTML + page data"]
  Stats --> API["Analytics API JSON"]
  Web --> UI["Dashboard FAQ Admin UI React"]
  API --> Consumers[External consumers]
```

The React app renders from `window.__PAGE_DATA__` injected by the server; the JSON API is intended for external consumers.

## Requirements

- Node.js 18+
- PostgreSQL database

## Environment variables

```bash
NEO_DATABASE_URL="postgresql://user:password@localhost:5432/neo_usage"
NEO_NETWORK=MainNet
DORA_API_URL="https://api.coz.io"
ADMIN_TOKEN="change-me"
```

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
The FAQ is available at http://localhost:3000/faq.
Swagger docs are available at http://localhost:3000/api/docs (stats endpoints only).

The dashboard supports date range filters via `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

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
  - Normal GAS transfers (with a valid `from` address) are classified as normal transfers.
- **Normal transfer**
  - Transfers that are not swaps or gas claims and are not filtered out as ignored.
- **Ignored**
  - Self-transfers (`from == to`) are excluded from totals.
  - Zero-amount transfers are ignored if an amount is provided.

Precedence order: **swap > gas claim > ignored > normal transfer**.

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

## Admin job endpoints

- `POST /api/jobs/run` with optional `{ "date": "YYYY-MM-DD" }`.
- `POST /api/jobs/rebuild` with `{ "date": "YYYY-MM-DD" }` and `x-admin-token` header.
- `POST /api/jobs/backfill` with `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }` and `x-admin-token` header.
- `POST /api/jobs/backfill-last-30` with `x-admin-token` header (ingests yesterday + previous 29 days).
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
