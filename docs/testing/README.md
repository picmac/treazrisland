# Testing Strategy

This matrix captures the minimum automated coverage for TREAZRISLAND. Run the relevant suites before every pull request and confirm CI parity via `.github/workflows/ci.yml`.

## Test Matrix

| Layer              | Tooling                                | Scope                                             | Trigger                                                         |
| ------------------ | -------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Lint               | `npm run lint` (frontend & backend)    | Static analysis, import hygiene, TypeScript rules | Every commit, enforced in CI                                    |
| Unit               | `npm test` (Vitest)                    | Pure logic, hooks, services, Prisma utilities     | When touching `src/**` in each package                          |
| Integration        | Backend Vitest suites + Prisma test DB | Route handlers, storage adapters, auth utilities  | Changes to Fastify routes, Prisma schema, or storage plugins    |
| E2E Smoke          | `npm run test:e2e:smoke` (Playwright)  | Onboarding, login, library browse, admin uploads  | Optional locally; enable with `RUN_SMOKE_E2E=1` before releases |
| Build Verification | `npm run build`                        | Ensure production bundles compile                 | Required in CI for both packages                                |

## Local Workflow

1. **Install dependencies**: `npm ci` inside `backend/` and `frontend/`. If the lockfiles lag behind new tooling (e.g., Playwright), run `npm install` once to refresh them and commit the resulting `package-lock.json` updates.
2. **Run lint**: `npm run lint` in each package (use `npm run format:write` in the backend if Prettier reports changes).
3. **Unit tests**: execute `npm test` in both directories.
4. **Smoke E2E (optional)**: start the Docker Compose stack or local servers, then run `RUN_SMOKE_E2E=1 npm run test:e2e:smoke` from `frontend/`. The Playwright specs stub backend responses so they can execute against a static Next dev server. Refer to [`docs/testing/e2e.md`](./e2e.md) for detailed prerequisites, environment variables, and troubleshooting tips.
5. **Builds**: finish with `npm run build` in both packages to catch type regressions that static analysis may miss.

Document any skipped checks in the PR description and create follow-up issues when tests expose gaps.

## CI runbook

1. **Matrix job failures (lint/test/build):** Open the GitHub Actions run and inspect the `lint-test-build (backend|frontend)` job. Download the raw log for the failing step to capture ESLint/Vitest context. Re-run the job with `Act` locally (`act -j lint-test-build -W .github/workflows/ci.yml -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest`) if you need to reproduce containerised tooling.
2. **Prisma generate errors:** When the backend build fails because Prisma cannot download engines, cache the engines by running `npm run prisma:generate` locally and committing the refreshed `node_modules/.prisma/client` artifacts. In CI, verify that the `DATABASE_URL` points at the ephemeral Postgres container spun up by the Vitest suites.
3. **Next.js build regressions:** A failing frontend build typically surfaces type errors or missing environment variables. Ensure `.env.example` includes the required placeholder, then rely on the committed `frontend/.env.local` symlink to project-wide env defaults. Retry the build step in CI once the variable is documented.

## Local troubleshooting

- **Watch mode debugging:** `npm run test -- --watch` inside the affected package to re-run suites when files change. Pair with `LOG_LEVEL=trace` for the backend to surface additional Fastify diagnostics.
- **Dockerised smoke tests:** Launch the local stack (`docker compose -f infra/docker-compose.yml up -d --build backend frontend`) to execute Playwright smoke tests against a near-production environment before toggling `RUN_SMOKE_E2E=1` in CI.
- **Log correlation:** Use the structured `requestId` injected by the logging plugin to correlate backend test failures with HTTP interactions. `jq '.requestId'` on backend logs reveals the identifier that Playwright or Vitest saw during the failing scenario.
