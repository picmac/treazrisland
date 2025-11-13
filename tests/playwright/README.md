# Playwright smoke tests

This workspace contains the end-to-end smoke tests that exercise Treazr Island through the browser and backend APIs.

## Prerequisites

- Docker and Docker Compose plugin
- Browsers installed via `pnpm --filter @treazrisland/playwright exec playwright install --with-deps`

## Running the suite

The recommended entrypoint is the root `pnpm test:e2e` script, which:

1. Boots the Docker Compose stack defined under `infrastructure/compose/`.
2. Waits for the frontend (`5173`) and backend (`4000`) health checks.
3. Executes `pnpm --filter @treazrisland/playwright test:e2e`.
4. Stores screenshots, traces, and videos under `tests/playwright/artifacts/`.

Artifacts are retained for inspection after the run and can be attached to CI logs when this suite is automated.
