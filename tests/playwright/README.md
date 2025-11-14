# Playwright smoke tests

This workspace contains the end-to-end smoke tests that exercise Treazr Island through the browser and backend APIs.

## Prerequisites

- Docker and Docker Compose plugin
- Browsers installed via `pnpm --filter @treazrisland/playwright exec playwright install --with-deps`

## Running the suite

The recommended entrypoint is the root `pnpm test:e2e` script, which:

1. Boots the Docker Compose stack defined under `infrastructure/compose/`.
2. Waits for the frontend (`5173`) and backend (`4000`) health checks, periodically streaming the relevant container logs so slow boots are visible in real time.
3. Executes `pnpm --filter @treazrisland/playwright test:e2e`.
4. Stores screenshots, traces, and videos under `tests/playwright/artifacts/`.

Artifacts are retained for inspection after the run and can be attached to CI logs when this suite is automated.

### Debugging & wait tuning

- Every run captures the full `docker compose` log output inside `tests/playwright/artifacts/compose.log` and prints the backend/frontend service logs to the console every fifth healthcheck attempt. When a service fails to boot, the last 200 log lines are emitted before the script exits.
- If the frontend needs extra time to hydrate dependencies on a cold cache, set `E2E_WAIT_ATTEMPTS` (default `120`) and/or `E2E_WAIT_DELAY_SECONDS` (default `3`) to relax the healthcheck threshold without modifying the script.
