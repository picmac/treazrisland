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

### Login and onboarding happy path

Automated flows should follow the same journey that manual testers use when bootstrapping a fresh stack:

1. Visit `/onboarding` and wait for `frontend/src/onboarding/onboarding-entry.tsx` to resolve the status call. The page renders the `FirstAdminForm` while the backend reports the `first-admin` step as pending.
2. Submit the inaugural admin credentials. The form posts to `/onboarding/admin` via `frontend/src/lib/api/onboarding.ts#createFirstAdmin`, receives session tokens, and hydrates the `AuthProvider` with the new admin user.
3. The wizard automatically advances to the remaining setup steps (`system-profile`, `integrations`, `personalization`). Each panel is orchestrated by `frontend/src/onboarding/setup-wizard.tsx` and persists data by PATCHing `/onboarding/steps/:stepKey` through `updateOnboardingStep`.
4. After the backend flags `setupComplete`, redirect to `/login` and verify that the credentials created during onboarding work against `/auth/login` through `frontend/src/auth/login-form.tsx`.

Capturing these checkpoints in future Playwright specs guarantees that onboarding regressions surface quickly and that the login portal stays compatible with freshly provisioned instances.

### Auth portal smoke assertions

End-to-end coverage for the dedicated auth pages should exercise both the happy path and the protective branches exposed by the new server actions:

1. **Invitation redemption** – Visit `/signup?token=<invite>` and submit the player manifest. The form delegates to `frontend/app/(auth)/signup/actions.ts#redeemInvitationAction`, which proxies to the Fastify `/auth/signup` endpoint and mirrors the `Set-Cookie` headers into the Next.js response. Verify that the `treaz_refresh` cookie is present afterwards and that `AuthProvider` reflects the returned user payload.
2. **Primary login challenge** – Submit credentials on `/login`. The `LoginForm` now invokes the server action in `frontend/app/(auth)/login/actions.ts#performLogin`, so the test should assert that a successful response redirects to `/play` and that the session cookie is rotated. Snapshotting the network panel in Playwright ensures no duplicate login calls fire.
3. **MFA branch** – Trigger a `401` with `{ "mfaRequired": true }` (fixture users such as `smoke-mfa@example.com` ship with an active secret). The form should reveal the MFA inputs without clearing the primary credential fields, and a subsequent submit with the correct TOTP should resume the normal flow.
4. **Recovery codes** – Provide a recovery code instead of a TOTP to confirm that alternative factors are respected. This scenario uses the same server action but asserts that the fallback path succeeds.

Document the assertions you automate in `frontend/tests/auth/*.spec.ts` so future contributors understand which behaviors must remain intact.

### Netplay signalling checks

The signalling socket is now part of the smoke journey. Manual QA should verify that a host can boot a netplay session from `/play/:romId`, retrieve a peer token, and invite another account:

1. From the play view, select **Start netplay session**. Confirm that the panel surfaces a peer token for the host and that `/netplay/sessions` returns a `200` with the new session metadata.
2. In a separate browser, log in as the invited player and visit the same ROM page. The UI should present a **Join session** button when the participant status is `INVITED` or `DISCONNECTED`.
3. After joining, both clients should display **Signal connected** with a latency round-trip time and the participant list should reflect `CONNECTED` statuses.
4. Exchange a few offers/candidates via the emulator to confirm that `netplay.signal` rows are recorded (via Prisma) and that the Socket.IO transport is relaying data between browsers.
5. When the host ends the session, both clients should receive a session closed notice and the peer token should be purged from session storage.

The Playwright smoke test (`frontend/tests/e2e/smoke.spec.ts`) now asserts that `/netplay/sessions` responds during the play view load and that the Netplay controls render as expected. Keep those checks updated whenever the signalling UI changes.

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

