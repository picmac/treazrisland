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
4. **Smoke E2E (optional)**: start the Docker Compose stack or local servers, then run `RUN_SMOKE_E2E=1 npm run test:e2e:smoke` from `frontend/`. The Playwright specs stub backend responses so they can execute against a static Next dev server.
5. **Builds**: finish with `npm run build` in both packages to catch type regressions that static analysis may miss.

Document any skipped checks in the PR description and create follow-up issues when tests expose gaps.
