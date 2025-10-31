# Authentication Rate-Limit Drill – 2025-02-22

## Objectives
- Stress `/auth/login` and `/auth/refresh` endpoints with credential failures to validate `RATE_LIMIT_*` thresholds under load.
- Capture structured logs for lockout scenarios and confirm IP + user-agent metadata persists through the audit pipeline.

## Method
1. Exercised the Fastify endpoints with a scripted client (k6 scenario) targeting the admin auth flow at 5 requests/minute from two subnets.
2. Verified limiter behaviour manually via `npm run vitest -- src/routes/auth.security.test.ts --runInBand` to keep deterministic ordering.
3. Exported the resulting login audit rows using the Prisma studio snapshot utility to cross-reference IP and user-agent fields.

## Results
- Fourth attempt against `/auth/login` returns HTTP 429, matching the configured `RATE_LIMIT_AUTH_POINTS` boundary.
- Refresh token rotations respect the same ceiling; retries beyond threshold emit `429` events tagged with `rate-limit` in structured logs.
- Audit records now include `remoteAddress`, `userAgent`, and `status` for both `/auth/login` and `/auth/refresh`, matching the schema expected by observability.

## Follow-ups
- Roll the k6 script into CI smoke tests once additional SRE capacity is available.
- Share drill output with QA so manual rehearsal steps in `docs/testing/e2e.md` reference both automated and scripted coverage.
