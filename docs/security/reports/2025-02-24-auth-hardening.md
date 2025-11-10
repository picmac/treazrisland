# Authentication Hardening Validation – 2025-02-24

## Rate-limit load test
- **Scenario:** Exercised `/auth/login` with repeated credential failures to confirm the per-endpoint limiter enforces `RATE_LIMIT_AUTH_POINTS`.
- **Method:** Added Vitest coverage in `backend/src/routes/auth.security.test.ts` and executed `npm test -- backend/src/routes/auth.security.test.ts`.
- **Result:** The first three attempts returned HTTP 401 while the fourth triggered HTTP 429, matching the configured threshold.

## Lockout drill logging
- **Scenario:** Simulated lockout behaviour to ensure login audit records capture IP, user agent, and failure status.
- **Method:** New Vitest coverage under `backend/src/routes/auth.security.test.ts` injects requests with a fixed `remoteAddress` and `user-agent` header, then asserts the Prisma audit payload includes those attributes.
- **Result:** Two failed attempts emitted `loginAudit.create` calls containing the expected metadata (IP, UA, `FAILURE` event), satisfying the logging requirement.
