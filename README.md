# Neo N3 Real Usage

A NestJS + Handlebars dashboard that tracks Neo N3 daily activity and classifies it into swaps, normal transfers, and gas claims.

## Requirements

- Node.js 18+
- PostgreSQL database

## Environment variables

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/neo_usage"
NEO_NETWORK=MainNet
NEO_API_BASE_URL="https://your-neo-api"
DEX_CONTRACT_ALLOWLIST="0xswapcontract1,0xswapcontract2"
ADMIN_TOKEN="change-me"
```

## Running

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Visit http://localhost:3000 to see the dashboard.

## Classification rules

Classification is handled in `src/classifier/classifier.ts` and is deterministic.

- **Swap (real usage)**
  - A transaction is a swap if it invokes a contract script hash that is in the DEX allowlist (`DEX_CONTRACT_ALLOWLIST`) **and** the invocation method name matches a swap-like method name (e.g. `swap`, `swapToken`).
- **Gas claim (not real usage)**
  - Gas claims are detected using a known contract allowlist (defaulted in `IngestionService` to known GAS claim contracts).
  - If your provider exposes explicit claim transactions, map them to an invocation contract hash or expand the allowlist.
- **Normal transfer (real usage)**
  - Native NEO/GAS transfers that are not swaps and not gas claims.
  - Self-transfers (`from == to`) are excluded from real usage.
  - Zero-amount transfers are ignored if an amount is provided.

Precedence order: **swap > gas claim > normal transfer**.

## Neo API provider

The provider is abstracted behind the `NeoClient` interface (`src/neo-client/neo-client.interface.ts`).
The HTTP implementation assumes a REST endpoint:

```
GET {NEO_API_BASE_URL}/transactions?date=YYYY-MM-DD&cursor=...
```

Expected response:

```json
{
  "transactions": [
    {
      "txid": "...",
      "timestamp": "2024-01-01T00:00:00Z",
      "blockIndex": 123456,
      "transfers": [{ "from": "...", "to": "...", "asset": "NEO", "amount": "1" }],
      "invocation": { "contract": "0x...", "method": "swap" },
      "raw": {}
    }
  ],
  "nextCursor": "...",
  "lastBlockIndex": 123456
}
```

If your provider uses a different response, adapt `HttpNeoClient`.

## Admin job endpoints

- `POST /api/jobs/run` with optional `{ "date": "YYYY-MM-DD" }`.
- `POST /api/jobs/rebuild` with `{ "date": "YYYY-MM-DD" }` and `x-admin-token` header.

## Tests

```bash
npm test
```
