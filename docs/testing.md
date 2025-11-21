# Testing guide

This workspace ships with fast-running unit/component tests and Playwright smoke coverage. Use the commands below for common flows.

## Linting

- `pnpm lint` — run ESLint across the backend and frontend packages.

## Unit and component tests

- `pnpm test` — executes Vitest suites in both apps. Coverage reports land in `backend/coverage/` and `frontend/coverage/` thanks to the workspace vitest configs.
- `pnpm --filter @treazrisland/backend test` — focuses on backend-only Vitest runs (uses Prisma client generation as part of `pretest`).
- `pnpm --filter treazrisland-frontend test` — runs frontend component tests in a JSDOM environment.

## Playwright (end-to-end)

- Install browsers once per environment: `pnpm --filter @treazrisland/playwright exec playwright install --with-deps`
- Run the suite against a local stack: `pnpm --filter @treazrisland/playwright test`

Artifacts (videos, traces, screenshots) are written to `tests/playwright/artifacts/test-results/` when the suite finishes.
