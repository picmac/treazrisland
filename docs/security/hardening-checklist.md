# TREAZRISLAND Hardening Checklist

This guide enumerates the operational controls required before promoting a TREAZRISLAND stack to staging or production. Pair it with `docs/security/threat-model.md` and the Coding Agents Playbook when reviewing new changes.

## Authentication & Rate Limiting

- [x] `JWT_SECRET` rotated before each major release and stored in a secrets manager (Vault, SSM, Doppler). Never reuse the default values from `.env.example` or the shared `.env` file checked into version control. _(Rotated 2025-02-12 by Security/Ops; stored in Vault `secret/data/treaz/prod/backend#JWT_SECRET`; process documented in [Operator Runbook §1](../operators/runbook.md#1-bootstrap-the-stack).)_
- [x] Default rate limits (`RATE_LIMIT_*`) tuned for expected traffic. Admin auth endpoints must stay at `≤5` requests/minute to prevent credential stuffing. _(Validated 2025-02-22 during the auth drill documented in `docs/security/reports/2025-02-22-rate-limit-drill.md` and reinforced 2025-02-24 via new Vitest coverage in `backend/src/routes/auth.security.test.ts`; see `docs/security/reports/2025-02-24-auth-hardening.md`. **SEC-45** closed.)_
- [x] `/auth/login`, `/auth/refresh`, and `/admin/*` routes exercised with lockout scenarios to ensure structured logs capture IP, user agent, and status. _(Simulated 2025-02-22 in the manual drill captured in `docs/security/reports/2025-02-22-rate-limit-drill.md` and re-run with Vitest injection tests on 2025-02-24; audit results archived in `docs/security/reports/2025-02-24-auth-hardening.md`. **SEC-46** closed.)_

## Secrets & Key Management

- [ ] ScreenScraper API tokens rotated every 90 days; replacement values stored outside the codebase. _(Pending – Owner: Integrations (Ravi Patel); align vendor credential rotation by 2025-03-15; tracked in **SEC-47**.)_
- [x] `METRICS_TOKEN` set to a long, random value and distributed only to observability tooling. _(Rotated 2025-02-08; stored in Vault `secret/data/treaz/prod/observability#METRICS_TOKEN`; Compose overrides documented in [Operator Runbook §4](../operators/runbook.md#4-metrics--health).)_
- [x] Audit access to the object storage credentials (`STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`). Keys must be scoped to the TREAZ buckets with read/write but no delete permissions unless lifecycle policies exist. _(Completed 2025-02-24; restricted policy codified at `infra/minio/policies/treaz-uploader.json` and documented in `docs/security/reports/2025-02-24-storage-credential-audit.md`. Follow-up automation captured under **SEC-60**.)_

## Storage Validation

- [x] MinIO/S3 buckets created with versioning and server-side encryption enabled. ROM and asset buckets enforce MIME filtering where supported. _(Validated 2025-02-11 using `mc version enable` and `mc encrypt set`; see `docs/operators/storage-validation-2025-02.md`.)_
- [x] Upload pipelines verified with malicious archive samples; antivirus or sandbox scan results captured in release notes. _(Completed 2025-02-24 by running ClamAV against the EICAR test signature; see `docs/security/reports/2025-02-24-antivirus-validation.md`. **SEC-49** closed.)_
- [x] Retention policies applied to `/roms/uploads` audit tables and corresponding storage prefixes to prevent unbounded growth. _(Implemented 2025-02-24 via `backend/scripts/retention/prune-rom-upload-audit.ts` and MinIO lifecycle rule `infra/minio/lifecycle/uploads-retention.json`; details in `docs/security/reports/2025-02-24-retention.md`. Automation backlog tracked in **SEC-61**.)_

## Observability & Metrics

- [x] `/metrics` endpoint exposed only on internal networks or behind an authenticated scrape job using `METRICS_TOKEN`. _(Hardened 2025-02-24 by enforcing CIDR allow lists in `backend/src/plugins/observability.ts`, updating env parsing, and wiring Prometheus bearer auth in `infra/docker-compose.prod.yml`. Refer to `docs/security/threat-model.md` and `infra/monitoring/prometheus.yml`. **SEC-51** closed.)_
- [x] When enabling metrics, configure at least one safeguard: set `METRICS_ALLOWED_CIDRS` and/or `METRICS_TOKEN`. Startup now fails if both are missing, and automated tests cover 403/401 enforcement. _(Added 2025-02-27 alongside env validation in `backend/src/config/env.ts` and new coverage in `backend/src/plugins/observability.security.test.ts` / `backend/src/config/env.security.test.ts`. **SEC-51** regression guard.)_
- [x] Log shipping pipelines confirm that sensitive headers (Authorization, cookies, passwords) are redacted by Fastify/Pino serializers. _(Verified 2025-02-14 against Fastify logger redaction in `backend/src/server.ts`; sample payload archived in `docs/observability/redaction-verification-2025-02.md`.)_
- [x] Prometheus (or compatible) alerts configured for upload failure spikes, enrichment queue backlog, and playback error rates. _(Configured 2025-02-24 with `infra/monitoring/rules/treazrisland.rules.yml` and routed through `infra/monitoring/alertmanager.yml`; coverage noted in `docs/security/threat-model.md`. **SEC-52** closed.)_

## Change Management

- [x] CI pipeline (`.github/workflows/ci.yml`) succeeds on lint, unit tests, and build steps for both frontend and backend packages. _(GitHub Actions run `CI #2025-02-17` succeeded for backend/frontend lint, test, build; logged in `docs/releases/ci-history.md`.)_
- [x] Release notes updated with manual runbooks for seeding and enrichment. _(Updated 2025-02-18 in `docs/releases/mvp.md` to reflect current seeding and enrichment steps.)_
- [x] Regression screenshots in `docs/qa/` refreshed when UI flows change. _(Updated baselines 2025-02-24; see `docs/qa/` assets and summary below. **SEC-53** closed.)_

### Follow-up tickets

- **SEC-47** – ScreenScraper credential rotation cadence (Owner: Ravi Patel, due 2025-03-15).
- **SEC-48** – Object storage credential audit logging (Owner: Marta Chen, due 2025-03-20).
- **SEC-50** – Storage + DB retention automation (Owner: Sara Lee, due 2025-03-22).
- **SEC-54** – Stage CSP/Helmet enforcement and validation (Owner: Mika Ito, due 2025-03-07).
- **SEC-55** – Lock down WebSocket origin checks (Owner: Diego Flores, due 2025-03-07).
- **SEC-56** – Centralized log shipping & retention policy (Owner: Nora Blake, due 2025-03-04).
- **SEC-57** – Add automated dependency vulnerability scans (Owner: Omar Reed, due 2025-03-06).
- **SEC-58** – Monthly Docker base image refresh automation (Owner: Zoe Hart, due 2025-03-10).
- **SEC-60** – Automate weekly MinIO policy validation for `treaz-uploader` (Owner: Marta Chen, due 2025-03-15).
- **SEC-61** – Schedule `npm run retention:prune` and lifecycle rule deployment (Owner: Sara Lee, due 2025-03-29).
