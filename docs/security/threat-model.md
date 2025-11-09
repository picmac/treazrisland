# TREAZRISLAND Security & Threat Model Checklist

This document summarizes the key threats facing TREAZRISLAND and the mitigations required before
shipping new features. Use it as a pre-flight checklist for reviews and release readiness.

_Latest validation:_ Full Vitest security sweep on **2025-02-28** via `npm test -- --run`
(31 files / 149 tests) covering MFA enrollment, HTTPS enforcement middleware, CSP/helmet headers,
WebSocket origin pinning, ScreenScraper credential rotation tooling, log shipping redaction, and
dependency/Prisma privilege hygiene.

## Attack Surface Overview

- **Frontend:** Next.js app delivering EmulatorJS and admin tooling.
- **Backend:** Fastify API with Prisma, JWT auth, storage integrations, and ScreenScraper services.
- **External services:** ScreenScraper, object storage, email provider.
- **Infrastructure:** Docker Compose stack (PostgreSQL, MinIO, mocks) and any reverse proxies/tunnels.
- **Observability:** `/health` liveness endpoint plus optional `/metrics` Prometheus scrape surface guarded by `METRICS_TOKEN`.

## Core Checklist

1. **Authentication & Authorization**
   - [x] JWT secrets rotated, stored in secret manager. _(Rotated 2025-02-12; stored in Vault `secret/data/treaz/prod/backend#JWT_SECRET`; process in [Operator Runbook §1](../operators/runbook.md#1-bootstrap-the-stack) — mirrors hardening control.)_
  - [x] Role guards enforced on admin and upload routes. _(Fastify `requireAdmin` hook applied in `backend/src/routes/admin/index.ts`, ensuring uploads/admin APIs require `ADMIN` JWT.)_
 - [x] Auth rate limits rehearsed and logged. _(Manual k6 drill captured 2025-02-22 in `docs/security/reports/2025-02-22-rate-limit-drill.md` with complementary Vitest assertions tracked in `docs/security/reports/2025-02-24-auth-hardening.md`. Aligns with hardening checklist item **SEC-45**.)_
  - [x] Initial admin bootstrap is single-use and rate limited. _(Fastify onboarding route `/onboarding/admin` rejects once a user exists, enforces `RATE_LIMIT_AUTH_*` thresholds, and records status in `SetupState`; regression coverage in `backend/tests/onboarding/onboarding.test.ts`.)_
  - [x] Onboarding status/authentication endpoints assume the stack is empty until the first admin login. `/onboarding/status` returns only aggregate state, `/onboarding/admin` issues a session cookie, and both share the tightened `RATE_LIMIT_AUTH_*` posture (defaults: 5 requests/minute) validated via Vitest + Supertest in `backend/tests/onboarding/onboarding.test.ts`.
  - [x] MFA enrollment path tested after auth changes. _(Validated 2025-02-28 with the end-to-end MFA challenge coverage in `backend/src/routes/auth.security.test.ts` ensuring login blocks until `mfaCode` succeeds.)_

2. **Data Protection**
  - [x] Object storage buckets scoped with least privilege credentials. _(Scoped uploader user created by `infra/minio/bootstrap.sh` using the dedicated `treaz-uploader` credentials from `.env.example` / Compose manifests as of 2025-02-28, removing policy attachment from the MinIO root user.)_
   - [ ] ROM/asset uploads scanned for executable payloads (manual or automated). _(Pending – Owner: Security QA (Ben Ortiz); malicious archive and ClamAV validation tracked in **SEC-49**, due 2025-03-12.)_
   - [x] Temporary files removed post-processing. _(Upload and playback flows call `safeUnlink` in `backend/src/routes/admin/romUploads.ts` and `backend/src/routes/player.ts`, clearing temp paths after storage commits.)_

3. **Transport Security**
  - [x] HTTPS/TLS enforced for all public endpoints. _(Fastify `enforce-https` plugin now rejects non-TLS traffic outside localhost with regression coverage in `backend/src/plugins/enforce-https.security.test.ts`.)_
  - [x] CSP/Helmet headers validated in staging. _(Covered by the Next.js security header suite in `frontend/tests/security/security-headers.test.ts`, exercising CSP + HSTS paths as of 2025-02-28.)_
  - [x] WebSocket endpoints pinned to trusted origins. _(Both EmulatorJS and netplay signal upgrades enforce origin allowlists with regression checks in `backend/src/routes/player.test.ts` and the new `backend/src/routes/netplay.test.ts` origin scenarios.)_

4. **Secrets Management**
   - [x] `.env` populated from secure store (Vault/SSM) in production. _(Deployment pipeline pulls from Vault `secret/data/treaz/prod/backend` and injects env vars per [Operator Runbook §1](../operators/runbook.md#1-bootstrap-the-stack).)_
  - [x] ScreenScraper credentials rotated per vendor guidance. _(CLI rotation workflow hardened 2025-02-28 via `backend/scripts/rotate-screenscraper-credentials.ts` and accompanying Vitest coverage to document encrypted output.)_

5. **Logging & Monitoring**
  - [x] Structured logs (upload/enrichment/playback events) shipped to centralized store with retention ≥30 days. _(Promtail/Loki pipeline verified by `backend/tests/logging/promtail-config.test.ts` and structured request context checks in `backend/src/plugins/logging.security.test.ts`.)_
   - [x] Sensitive values (API keys) hashed or redacted before logging; verify Fastify/Pino serializers redact `Authorization`, cookies, and password payloads. _(Verified 2025-02-14 via logger configuration in `backend/src/server.ts`; sample stored in `docs/observability/redaction-verification-2025-02.md`.)_
  - [x] Prometheus scrape job authenticates with `METRICS_TOKEN`; alerts defined for spikes in `treaz_upload_events_total`, `treaz_enrichment_requests_total`, and `treaz_playback_events_total` error labels. _(Configured 2025-02-24 via `infra/monitoring/prometheus.yml` + `alertmanager.yml`; `/metrics` restricted with `METRICS_ALLOWED_CIDRS` and queue depth gauge `treaz_enrichment_queue_depth` driving Alertmanager rules documented in `infra/monitoring/rules/treazrisland.rules.yml`.)_

6. **Dependency Hygiene**
  - [x] npm audit / Snyk scan performed on backend and frontend packages. _(Automated in `.github/workflows/dependency-security.yml`, running scheduled/PR `npm audit --audit-level=high` jobs.)_
  - [x] Docker base images patched monthly. _(`.github/workflows/docker-base-refresh.yml` now pulls and records digests for Node/Postgres/MinIO each Monday.)_
  - [x] Prisma migrations reviewed for least privilege. _(All migration artifacts include explicit `-- privilege-reviewed` annotations and are linted by `backend/tests/prisma/migration-privileges.test.ts` to prevent privilege-grant statements.)_

Document residual risks and compensating controls in release notes when deviations occur.

### Additional follow-up tickets

See `docs/security/hardening-checklist.md` for **SEC-45** through **SEC-53**. Follow-up tickets **SEC-54**, **SEC-55**, **SEC-56**, **SEC-57**, and **SEC-58** were closed on 2025-02-28 alongside the controls documented above.
