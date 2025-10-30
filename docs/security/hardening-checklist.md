# TREAZRISLAND Hardening Checklist

This guide enumerates the operational controls required before promoting a TREAZRISLAND stack to staging or production. Pair it with `docs/security/threat-model.md` and the Coding Agents Playbook when reviewing new changes.

## Authentication & Rate Limiting

- [x] `JWT_SECRET` rotated before each major release and stored in a secrets manager (Vault, SSM, Doppler). Never reuse the default values from `.env.example` or `.env.docker`. _(Rotated 2025-02-12 by Security/Ops; stored in Vault `secret/data/treaz/prod/backend#JWT_SECRET`; process documented in [Operator Runbook §1](../operators/runbook.md#1-bootstrap-the-stack).)_
- [ ] Default rate limits (`RATE_LIMIT_*`) tuned for expected traffic. Admin auth endpoints must stay at `≤5` requests/minute to prevent credential stuffing. _(Pending – Owner: Backend (Nadia Kim); load test and tuning scheduled 2025-03-05 using the k6 auth scenario; tracked in follow-up ticket **SEC-45**.)_
- [ ] `/auth/login`, `/auth/refresh`, and `/admin/*` routes exercised with lockout scenarios to ensure structured logs capture IP, user agent, and status. _(Pending – Owner: QA (Inez Morales); lockout rehearsal and log export due 2025-02-28 per `docs/testing/e2e.md`; tracked in **SEC-46**.)_

## Secrets & Key Management

- [ ] ScreenScraper API tokens rotated every 90 days; replacement values stored outside the codebase. _(Pending – Owner: Integrations (Ravi Patel); align vendor credential rotation by 2025-03-15; tracked in **SEC-47**.)_
- [x] `METRICS_TOKEN` set to a long, random value and distributed only to observability tooling. _(Rotated 2025-02-08; stored in Vault `secret/data/treaz/prod/observability#METRICS_TOKEN`; Compose overrides documented in [Operator Runbook §4](../operators/runbook.md#4-metrics--health).)_
- [ ] Audit access to the object storage credentials (`STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`). Keys must be scoped to the TREAZ buckets with read/write but no delete permissions unless lifecycle policies exist. _(Pending – Owner: Security (Marta Chen); enabling IAM audit export to the SIEM by 2025-03-20; tracked in **SEC-48**.)_

## Storage Validation

- [x] MinIO/S3 buckets created with versioning and server-side encryption enabled. ROM and asset buckets enforce MIME filtering where supported. _(Validated 2025-02-11 using `mc version enable` and `mc encrypt set`; see `docs/operators/storage-validation-2025-02.md`.)_
- [ ] Upload pipelines verified with malicious archive samples; antivirus or sandbox scan results captured in release notes. _(Pending – Owner: Security QA (Ben Ortiz); malicious archive test plus ClamAV report capture planned 2025-03-12; tracked in **SEC-49**.)_
- [ ] Retention policies applied to `/roms/uploads` audit tables and corresponding storage prefixes to prevent unbounded growth. _(Pending – Owner: Data Engineering (Sara Lee); design MinIO lifecycle rules and DB retention job by 2025-03-22; tracked in **SEC-50**.)_

## Observability & Metrics

- [ ] `/metrics` endpoint exposed only on internal networks or behind an authenticated scrape job using `METRICS_TOKEN`. _(Pending – Owner: SRE (Linh Tran); restrict ingress and enforce mTLS for Prometheus scrape job by 2025-03-01; tracked in **SEC-51**.)_
- [x] Log shipping pipelines confirm that sensitive headers (Authorization, cookies, passwords) are redacted by Fastify/Pino serializers. _(Verified 2025-02-14 against Fastify logger redaction in `backend/src/server.ts`; sample payload archived in `docs/observability/redaction-verification-2025-02.md`.)_
- [ ] Prometheus (or compatible) alerts configured for upload failure spikes, enrichment queue backlog, and playback error rates. _(Pending – Owner: SRE (Linh Tran); add Alertmanager rules by 2025-03-08; tracked in **SEC-52**.)_

## Change Management

- [x] CI pipeline (`.github/workflows/ci.yml`) succeeds on lint, unit tests, and build steps for both frontend and backend packages. _(GitHub Actions run `CI #2025-02-17` succeeded for backend/frontend lint, test, build; logged in `docs/releases/ci-history.md`.)_
- [x] Release notes updated with manual runbooks for seeding and enrichment. _(Updated 2025-02-18 in `docs/releases/mvp.md` to reflect current seeding and enrichment steps.)_
- [ ] Regression screenshots in `docs/qa/` refreshed when UI flows change. _(Pending – Owner: QA Design (Lara Ng); capture staging baseline after UI polish by 2025-02-25; tracked in **SEC-53**.)_

### Follow-up tickets

- **SEC-45** – Auth rate-limit load test & tuning (Owner: Nadia Kim, due 2025-03-05).
- **SEC-46** – Authentication lockout log rehearsal (Owner: Inez Morales, due 2025-02-28).
- **SEC-47** – ScreenScraper credential rotation cadence (Owner: Ravi Patel, due 2025-03-15).
- **SEC-48** – Object storage credential audit logging (Owner: Marta Chen, due 2025-03-20).
- **SEC-49** – Malicious archive antivirus validation (Owner: Ben Ortiz, due 2025-03-12).
- **SEC-50** – Storage + DB retention automation (Owner: Sara Lee, due 2025-03-22).
- **SEC-51** – Metrics endpoint network hardening (Owner: Linh Tran, due 2025-03-01).
- **SEC-52** – Prometheus alert coverage for uploads/enrichment/playback (Owner: Linh Tran, due 2025-03-08).
- **SEC-53** – Refresh QA baseline screenshots post-UI updates (Owner: Lara Ng, due 2025-02-25).
