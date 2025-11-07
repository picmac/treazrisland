# Playwright Smoke End-to-End Guide

The Playwright smoke suite validates the golden paths for onboarding, authentication, library browsing, EmulatorJS playback, and the admin upload flow. The specs now exercise the real Fastify backend instead of relying on route intercepts, so deterministic fixtures must exist before launching the tests. This guide covers the prerequisites, fixture bootstrap, and how to execute the suite from `frontend/`.

## Prerequisites

- **Node.js 24 LTS and npm 10+** – match the versions used by the monorepo to avoid dependency resolution drift.
- **Docker & Docker Compose** – required to launch the local stack defined in `infra/docker-compose.yml`.
- **Playwright browsers** – install once per machine:
  
  ```bash
  cd frontend
  npx playwright install --with-deps
  ```

If you manage services manually (without Compose), ensure the backend, frontend, and supporting stores (PostgreSQL, MinIO) are reachable at the URLs defined in each package's `.env` files.

## Launch the local stack

1. Export any environment variables you need to override (e.g., database passwords) before booting the stack.
2. Build and start the Compose services:

   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```

   This brings up PostgreSQL, MinIO, and hot-reloading containers for the backend and frontend apps. Wait until the frontend container reports that the Next.js dev server is listening on port `3000`.

3. Seed the deterministic smoke fixtures and ensure the stack is healthy:

   ```bash
   ./scripts/smoke/local-stack.sh
   ```

   The script waits for the backend health endpoint, runs `npm run prisma:seed:smoke` inside the backend container, verifies the invitation, platform, and ROM fixtures, and confirms that the required MinIO buckets exist. Override the defaults with `SMOKE_*` environment variables when needed (see below).

4. (Optional) If you prefer running the apps directly, start them from separate terminals after installing dependencies:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Running the smoke suite

From the `frontend/` directory, enable the smoke specs and execute them against the locally running frontend:

```bash
RUN_SMOKE_E2E=1 npm run test:e2e:smoke
```

### Environment variables

The suite honors the following environment variables:

- `RUN_SMOKE_E2E` – must be set to a truthy value (`1`, `true`, `yes`) or the specs are skipped.
- `PLAYWRIGHT_BASE_URL` – overrides the default `http://localhost:3000`. Use this when the frontend dev server runs on another host or port.
- `SMOKE_INVITE_TOKEN` – invitation token used to redeem the seeded admin invite. Defaults to `smoke-test-token`.
- `SMOKE_INVITE_EMAIL` – email address tied to the invitation. Defaults to `deckhand-smoke@example.com`.
- `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_ADMIN_NICKNAME` – credentials entered during the onboarding flow. Defaults are safe for local smoke runs.
- `SMOKE_USER_PASSWORD`, `SMOKE_USER_NICKNAME`, `SMOKE_USER_DISPLAY_NAME` – controls the account created from the invitation.
- `SMOKE_PLATFORM_NAME`, `SMOKE_PLATFORM_SLUG`, `SMOKE_ROM_ID`, `SMOKE_ROM_TITLE` – identify the demo platform and ROM the specs navigate to.
- `SMOKE_STORAGE_ROOT` – filesystem root that the onboarding wizard saves. Defaults to `/var/treaz/storage` when unset and should align with the backend's `STORAGE_LOCAL_ROOT`.

## Deterministic fixtures

`backend/prisma/seed-test-fixtures.ts` creates the minimal data that the smoke suite expects:

- A pending invitation with the configured `SMOKE_INVITE_TOKEN` and email address.
- A `Smoke Test Console` platform containing the `Smoke Test Adventure` ROM with a ready binary.
- Storage configuration pointing at the local filesystem root and buckets defined in the Docker Compose stack.
- A reset onboarding state so the first test can create the inaugural admin account.

`scripts/smoke/local-stack.sh` runs the seed every time to guarantee a clean slate. If you change any of the defaults, export matching `SMOKE_*` variables before invoking the script and the Playwright command.

## Troubleshooting

- **Playwright cannot connect to the dev server** – verify the frontend container is running and that `PLAYWRIGHT_BASE_URL` matches the accessible URL.
- **Browsers fail to launch on Linux** – rerun `npx playwright install --with-deps` to install missing system dependencies.
- **Tests skip unexpectedly** – confirm `RUN_SMOKE_E2E` is exported in the same shell where you invoke `npm run test:e2e:smoke`.

