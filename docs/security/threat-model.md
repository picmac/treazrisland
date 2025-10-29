# TREAZRISLAND Security & Threat Model Checklist

This document summarizes the key threats facing TREAZRISLAND and the mitigations required before
shipping new features. Use it as a pre-flight checklist for reviews and release readiness.

## Attack Surface Overview

- **Frontend:** Next.js app delivering EmulatorJS, Netplay UI, and admin tooling.
- **Backend:** Fastify API with Prisma, JWT auth, storage integrations, PixelLab, ScreenScraper, and Netplay services.
- **External services:** PixelLab.ai, ScreenScraper, optional Netplay signaling provider, object storage, email provider.
- **Infrastructure:** Docker Compose stack (PostgreSQL, MinIO, mocks) and any reverse proxies/tunnels.

## Core Checklist

1. **Authentication & Authorization**
   - [ ] JWT secrets rotated, stored in secret manager.
   - [ ] Role guards enforced on admin and upload routes.
   - [ ] MFA enrollment path tested after auth changes.

2. **Data Protection**
   - [ ] Object storage buckets scoped with least privilege credentials.
   - [ ] ROM/asset uploads scanned for executable payloads (manual or automated).
   - [ ] Temporary files removed post-processing.

3. **Transport Security**
   - [ ] HTTPS/TLS enforced for all public endpoints.
   - [ ] CSP/Helmet headers validated in staging.
   - [ ] WebSocket endpoints pinned to trusted origins.

4. **Secrets Management**
   - [ ] `.env` populated from secure store (Vault/SSM) in production.
   - [ ] PixelLab and ScreenScraper credentials rotated per vendor guidance.
   - [ ] Netplay API key distribution limited to backend service account.

5. **Logging & Monitoring**
   - [ ] Structured logs shipped to centralized store with retention ≥30 days.
   - [ ] Alerting configured for repeated auth failures, upload anomalies, and Netplay errors.
   - [ ] Sensitive values (API keys, join codes) hashed or redacted before logging.

6. **Dependency Hygiene**
   - [ ] npm audit / Snyk scan performed on backend and frontend packages.
   - [ ] Docker base images patched monthly.
   - [ ] Prisma migrations reviewed for least privilege.

## Netplay-Specific Considerations

1. **Session Hijacking Prevention**
   - [ ] Join codes provide ≥20 bits of entropy and expire on first successful use.
   - [ ] Backend validates the authenticated user owns the session before allowing host actions.
   - [ ] Cleanup job (`NETPLAY_SESSION_SWEEP_INTERVAL_MINUTES`) removes expired sessions promptly.

2. **API Security**
   - [ ] `NETPLAY_SERVICE_API_KEY` stored outside source control and rotated quarterly.
   - [ ] Backend enforces request timeout (`NETPLAY_SERVICE_REQUEST_TIMEOUT_MS`) and circuit-breaking on repeated failures.
   - [ ] Input payloads to `/netplay/*` sanitized to prevent injection toward the signaling provider.

3. **Code & Protocol Integrity**
   - [ ] EmulatorJS build fingerprinted; Netplay feature flags disabled if checksum drifts unexpectedly.
   - [ ] TURN/WebRTC hints (`NEXT_PUBLIC_NETPLAY_TURN_RELAYS`) reference TLS-protected relays only.
   - [ ] Observability dashboards track `netplay.session_created_total`, `netplay.sessions_active`, and join failure rates.

Document residual risks and compensating controls in release notes when deviations occur.
