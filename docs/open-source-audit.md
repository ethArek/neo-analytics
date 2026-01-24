# Open-source readiness audit

Date: 2025-09-27

## Scope

- Reviewed repository contents for embedded credentials, API keys, tokens, or private endpoints.
- Checked README for documented secrets to confirm values are placeholders.
- Scanned git history for accidental `.env` commits.

## Findings

### Documented secrets

- `ADMIN_TOKEN` in `README.md` is documented as `change-me`, which is a placeholder value.
- `RPC_ENDPOINT_1` and `RPC_ENDPOINT_2` in `README.md` point to public Neo RPC endpoints and appear to be intended for documentation/examples.

### Source and test configuration

- Runtime configuration pulls secrets from environment variables (`ADMIN_TOKEN`, `RPC_ENDPOINT_1`, `RPC_ENDPOINT_2`, `NEO_DATABASE_URL`).
- Integration tests default to public RPC endpoints unless environment variables override them.

### Git history

- No `.env` files found in history.

## Recommendations

- Keep `.env` files out of version control (already covered by `.gitignore`).
- Continue using environment variables for secrets; do not commit production tokens.
- If you add any real endpoints or tokens, rotate them before publishing.
