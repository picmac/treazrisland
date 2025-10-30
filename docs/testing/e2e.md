# Playwright Smoke End-to-End Guide

The Playwright smoke suite validates the golden paths for onboarding, authentication, library browsing, and the admin upload flow. The specs run quickly because all backend calls are intercepted and stubbed while the Next.js runtime renders real UI routes. This guide covers the prerequisites, local stack bootstrapping, and how to execute the suite from `frontend/`.

## Prerequisites

- **Node.js 20+ and npm 10+** – match the versions used by the monorepo to avoid dependency resolution drift.
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

   This brings up PostgreSQL, MinIO, the PixelLab mock, and hot-reloading containers for the backend and frontend apps. Wait until the frontend container reports that the Next.js dev server is listening on port `3000`.

3. (Optional) If you prefer running the apps directly, start them from separate terminals after installing dependencies:

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

### Route behavior

The smoke specs intercept network calls with Playwright's routing API to keep the tests deterministic:

| Route pattern           | Behavior                          | Notes |
| ----------------------- | --------------------------------- | ----- |
| `**/auth/refresh`       | Stubbed with a 401 response       | Forces the app to treat the session as logged out when the suite begins. |
| `**/onboarding/status`  | Stubbed with `needsSetup: true`   | Simulates the first-admin experience. |
| `**/auth/login`         | Stubbed MFA challenge then success | Exercises the multi-step login flow without hitting the real backend. |
| `**/platforms`          | Stubbed with a single mock platform | Ensures the library UI renders predictable data. |
| `**/admin/platforms`    | Stubbed with one selectable platform | Allows the admin upload queue to populate without querying the API. |

All other requests (static assets, page navigations) are served by the running Next.js application. Do **not** point the smoke suite at production—its mocked responses bypass real authentication and persistence.

## Troubleshooting

- **Playwright cannot connect to the dev server** – verify the frontend container is running and that `PLAYWRIGHT_BASE_URL` matches the accessible URL.
- **Browsers fail to launch on Linux** – rerun `npx playwright install --with-deps` to install missing system dependencies.
- **Tests skip unexpectedly** – confirm `RUN_SMOKE_E2E` is exported in the same shell where you invoke `npm run test:e2e:smoke`.

