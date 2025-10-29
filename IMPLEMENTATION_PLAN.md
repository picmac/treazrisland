# TREAZRISLAND Initial Implementation Milestones

## Phase 1 – Onboarding & Auth Foundation
- **Ref PRD:** Section "Onboarding & User Management", "Authentication & Security".
- Scaffold Fastify app with JWT, rate limiting, and `/onboarding/status` + `/onboarding/admin` endpoints.
- Define Prisma schema for `User`, `UserInvitation`, `RefreshToken`, and password/MFA artifacts.
- Add Vitest + Supertest coverage for onboarding happy path and failure cases.
- Document security assumptions in `docs/security/threat-model.md` (WIP).

## Phase 2 – Frontend Onboarding Experience
- **Ref PRD:** "Onboarding & Users", "PixelLab Creative Pipeline".
- Bootstrap Next.js 19 app with Tailwind pixel theme baseline.
- Implement onboarding wizard consuming backend endpoints; integrate placeholder PixelLab imagery framed by PixelFrame components.
- Introduce API client utilities and start `docs/testing/e2e.md` guidance for login flow.

## Phase 3 – Library Discovery Skeleton
- **Ref PRD:** "Discovery & Library", "Favorites & Collections".
- Model core library tables (`Rom`, `Platform`, `RomAsset`) and seed script for sample ROM metadata.
- Expose `/roms` read endpoints with filtering + rate limiting, guarded via JWT.
- Create frontend routes for library grid leveraging virtualized list strategy noted in PRD.

## Phase 4 – PixelLab Service Integration
- **Ref PRD:** "PixelLab Creative Pipeline".
- Implement backend PixelLabService with caching metadata strategy and structured logging.
- Replace mock assets with dynamic renders saved to object storage (MinIO).
- Add admin UI controls for art refresh and cache invalidation with proper authorization.

## Phase 5 – Observability & Hardening
- **Ref PRD:** "Monitoring & Stats", "Security".
- Wire Fastify structured logging, health checks, and rate-limit telemetry.
- Fill out `docs/security/hardening-checklist.md` and `docs/testing/e2e.md` with concrete steps.
- Prepare CI workflows for lint/test, referencing infra container setup.

Open questions to clarify before implementation:
1. Preferred auth email delivery provider and integration strategy.
2. Final PixelLab OpenAPI schema and rate limit constraints.
3. Netplay service backend expectations for Phase 1 (stub vs. real implementation).
