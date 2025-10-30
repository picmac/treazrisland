# TREAZRISLAND Security & Threat Model Checklist

This document summarizes the key threats facing TREAZRISLAND and the mitigations required before
shipping new features. Use it as a pre-flight checklist for reviews and release readiness.

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
   - [ ] MFA enrollment path tested after auth changes. _(Pending – Owner: QA (Inez Morales); bundled with lockout rehearsal in **SEC-46**, due 2025-02-28.)_

2. **Data Protection**
   - [ ] Object storage buckets scoped with least privilege credentials. _(Pending – Owner: Security (Marta Chen); scope review and IAM audit logging tracked via **SEC-48**, due 2025-03-20.)_
   - [ ] ROM/asset uploads scanned for executable payloads (manual or automated). _(Pending – Owner: Security QA (Ben Ortiz); malicious archive and ClamAV validation tracked in **SEC-49**, due 2025-03-12.)_
   - [x] Temporary files removed post-processing. _(Upload and playback flows call `safeUnlink` in `backend/src/routes/admin/romUploads.ts` and `backend/src/routes/player.ts`, clearing temp paths after storage commits.)_

3. **Transport Security**
   - [ ] HTTPS/TLS enforced for all public endpoints. _(Pending – Owner: SRE (Linh Tran); production ingress hardening and certificate automation tracked in **SEC-51**, due 2025-03-01.)_
   - [ ] CSP/Helmet headers validated in staging. _(Pending – Owner: Frontend (Mika Ito); add Next.js CSP middleware and validation checklist by 2025-03-07; tracked in **SEC-54**.)_
   - [ ] WebSocket endpoints pinned to trusted origins. _(Pending – Owner: Backend (Diego Flores); enforce origin validation on emulator WebSocket upgrades by 2025-03-07; tracked in **SEC-55**.)_

4. **Secrets Management**
   - [x] `.env` populated from secure store (Vault/SSM) in production. _(Deployment pipeline pulls from Vault `secret/data/treaz/prod/backend` and injects env vars per [Operator Runbook §1](../operators/runbook.md#1-bootstrap-the-stack).)_
- [ ] ScreenScraper credentials rotated per vendor guidance. _(Pending – Owner: Integrations (Ravi Patel); cadence tracked in **SEC-47**, due 2025-03-15.)_

5. **Logging & Monitoring**
   - [ ] Structured logs (upload/enrichment/playback events) shipped to centralized store with retention ≥30 days. _(Pending – Owner: Observability (Nora Blake); Fluent Bit → Loki pipeline rollout planned 2025-03-04; tracked in **SEC-56**.)_
   - [x] Sensitive values (API keys) hashed or redacted before logging; verify Fastify/Pino serializers redact `Authorization`, cookies, and password payloads. _(Verified 2025-02-14 via logger configuration in `backend/src/server.ts`; sample stored in `docs/observability/redaction-verification-2025-02.md`.)_
   - [ ] Prometheus scrape job authenticates with `METRICS_TOKEN`; alerts defined for spikes in `treaz_upload_events_total`, `treaz_enrichment_requests_total`, and `treaz_playback_events_total` error labels. _(Partial – `METRICS_TOKEN` rotated 2025-02-08, but scrape network policy and Alertmanager rules pending in **SEC-51**/**SEC-52**, due early March.)_

6. **Dependency Hygiene**
   - [ ] npm audit / Snyk scan performed on backend and frontend packages. _(Pending – Owner: Platform (Omar Reed); add weekly `npm audit` job in CI by 2025-03-06; tracked in **SEC-57**.)_
   - [ ] Docker base images patched monthly. _(Pending – Owner: Infra (Zoe Hart); monthly rebuild automation slated for 2025-03-10; tracked in **SEC-58**.)_
   - [ ] Prisma migrations reviewed for least privilege. _(Pending – Owner: Data Engineering (Sara Lee); incorporate privilege checklist into review process alongside **SEC-50**, target 2025-03-22.)_

Document residual risks and compensating controls in release notes when deviations occur.

### Additional follow-up tickets

See `docs/security/hardening-checklist.md` for **SEC-45** through **SEC-53**. New risks captured here:

- **SEC-54** – Stage CSP/Helmet enforcement and validation (Owner: Mika Ito, due 2025-03-07).
- **SEC-55** – Lock down WebSocket origin checks (Owner: Diego Flores, due 2025-03-07).
- **SEC-56** – Centralized log shipping & retention policy (Owner: Nora Blake, due 2025-03-04).
- **SEC-57** – Add automated dependency vulnerability scans (Owner: Omar Reed, due 2025-03-06).
- **SEC-58** – Monthly Docker base image refresh automation (Owner: Zoe Hart, due 2025-03-10).
