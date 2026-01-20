# Neo Analytics

A NestJS + Handlebars dashboard that tracks Neo N3 daily activity and classifies it into swaps, normal transfers, and gas claims.

## Requirements

- Node.js 18+
- PostgreSQL database

## Environment variables

```bash
NEO_DATABASE_URL="postgresql://user:password@localhost:5432/neo_usage"
NEO_NETWORK=MainNet
RPC_ENDPOINT_1="https://mainnet1.neo.coz.io"
RPC_ENDPOINT_2="https://mainnet2.neo.coz.io"
ADMIN_TOKEN="change-me"
```

## Running

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Visit http://localhost:3000/dashboard to see the dashboard.
The FAQ is available at http://localhost:3000/faq.
Swagger docs are available at http://localhost:3000/api/docs (stats endpoints only).

The dashboard supports date range filters via `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

## Classification rules

Classification is handled in `src/classifier/classifier.ts` and is deterministic.

- **Swap**
  - A transaction is classified as a swap if it has **both**:
    1. An invocation with a swap-like method name (e.g. `swap`, `swapToken`, `swapTokens`, `swapExactTokens`)
    2. Multiple transfers (2 or more), which represent the token exchange in a swap operation
  - The detection is based on transaction data, not on a DEX contract allowlist
- **Gas claim**
  - Gas claims are detected based on transaction data: GAS transfers with no `from` address (or an empty `from` field).
  - This pattern indicates GAS being distributed from the system to a user, which is characteristic of gas claim operations in Neo N3.
  - Normal GAS transfers (with a valid `from` address) are classified as normal transfers.
- **Normal transfer**
  - Native NEO/GAS transfers that are not swaps and not gas claims.
  - Self-transfers (`from == to`) are excluded from totals.
  - Zero-amount transfers are ignored if an amount is provided.

Precedence order: **swap > gas claim > normal transfer**.

## Neo RPC provider

The provider is abstracted behind the `NeoClient` interface (`src/neo-client/neo-client.interface.ts`).
The RPC implementation uses JSON-RPC calls to scan blocks by date and extract NEP-17 `Transfer`
notifications for transactions (`src/neo-client/neo-client.service.ts`).

It relies on:

- `getblockcount`
- `getblock`
- `getapplicationlog`
- `getnativecontracts`

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

- `GET /admin/login` signs in an admin account.
- `GET /admin` shows the ingestion console for triggering manual ingestion runs.

## Tests

```bash
npm test
```
