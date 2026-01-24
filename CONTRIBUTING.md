# Contributing to Neo Analytics

Thanks for your interest in contributing! This guide covers local setup, development workflow, and expectations for contributions.

## Development workflow

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables (see `README.md`).
4. Generate Prisma client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. Start the development server:

   ```bash
   npm run start:dev
   ```

## Testing

Run the test suite with:

```bash
npm test
```

Integration tests that hit real RPC endpoints are gated by environment variables. See `test/rpc.integration.spec.ts` for details.

## Code style expectations

- Follow existing project structure and naming conventions.
- Prefer small, focused commits with descriptive messages.
- Keep services modular and favor dependency injection patterns already used in NestJS modules.
- Update or add tests when changing behavior.
- Update documentation when changing runtime configuration or endpoints.

## Pull request checklist

- [ ] Tests pass (`npm test`).
- [ ] Documentation updated (README, docs, or inline comments as needed).
- [ ] No secrets or credentials committed.
- [ ] Migrations included for schema changes.
