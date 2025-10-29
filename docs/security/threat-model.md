# TREAZRISLAND Security & Threat Model Checklist

This document summarizes the key threats facing TREAZRISLAND and the mitigations required before
shipping new features. Use it as a pre-flight checklist for reviews and release readiness.

## Attack Surface Overview

- **Frontend:** Next.js app delivering EmulatorJS and admin tooling.
- **Backend:** Fastify API with Prisma, JWT auth, storage integrations, PixelLab, and ScreenScraper services.
- **External services:** PixelLab.ai, ScreenScraper, object storage, email provider.
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

5. **Logging & Monitoring**
   - [ ] Structured logs shipped to centralized store with retention ≥30 days.
    - [ ] Sensitive values (API keys) hashed or redacted before logging.

6. **Dependency Hygiene**
   - [ ] npm audit / Snyk scan performed on backend and frontend packages.
   - [ ] Docker base images patched monthly.
   - [ ] Prisma migrations reviewed for least privilege.

Document residual risks and compensating controls in release notes when deviations occur.
