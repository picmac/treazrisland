# TREAZRISLAND Initial Implementation Milestones

## Phase 1 – Onboarding & Auth Foundation
- **Ref PRD:** Section "Onboarding & User Management", "Authentication & Security".
- Scaffold Fastify app with JWT, rate limiting, and `/onboarding/status` + `/onboarding/admin` endpoints.
- Define Prisma schema for `User`, `UserInvitation`, `RefreshToken`, and password/MFA artifacts.
- Add Vitest + Supertest coverage for onboarding happy path and failure cases.
- Implement SMTP mailer abstraction that reads `EMAIL_PROVIDER=smtp`, negotiates STARTTLS/implicit TLS when requested, and gracefully degrades when anonymous relay is configured. Cover password reset and invitation flows with integration smoke tests using a local MailHog/SMTP mock.
- Document security assumptions in `docs/security/threat-model.md` (WIP).

## Phase 2 – Frontend Onboarding Experience
- **Ref PRD:** "Onboarding & Users".
- Bootstrap Next.js 19 app with Tailwind pixel theme baseline.
- Implement onboarding wizard consuming backend endpoints; integrate placeholder imagery framed by PixelFrame components.
- Introduce API client utilities and start `docs/testing/e2e.md` guidance for login flow.

## Phase 3 – Library Discovery Skeleton
- **Ref PRD:** "Discovery & Library", "Favorites & Collections".
- Model core library tables (`Rom`, `Platform`, `RomAsset`) and seed script for sample ROM metadata.
- Expose `/roms` read endpoints with filtering + rate limiting, guarded via JWT.
- Create frontend routes for library grid leveraging virtualized list strategy noted in PRD.

## Phase 4 – Creative Asset Pipeline
- Define strategy for curating and managing SNES-style artwork without external generation services.
- Implement storage workflows for curated assets within object storage (MinIO).
- Add admin UI controls for refreshing artwork metadata with proper authorization.

## Phase 5 – Observability & Hardening
- **Ref PRD:** "Monitoring & Stats", "Security".
- Wire Fastify structured logging, health checks, and rate-limit telemetry.
- Fill out `docs/security/hardening-checklist.md` and `docs/testing/e2e.md` with concrete steps.
- Prepare CI workflows for lint/test, referencing infra container setup.

## Phase 6 – Netplay Enablement
- **Ref PRD:** "Game Detail, Emulator & Netplay".
- Extend backend with `/netplay/sessions` CRUD and `/netplay/signal` WebRTC signaling endpoints guarded by JWT and per-session tokens. Persist session metadata (host, participants, ROM, status, timeouts) in Prisma.
- Integrate a signaling service (Fastify WebSocket or Socket.IO) that enforces `NETPLAY_IDLE_TIMEOUT`, `NETPLAY_MAX_HOSTED_SESSIONS`, and `NETPLAY_MAX_CONCURRENT_SESSIONS` limits, plus heartbeat tracking.
- Update frontend player experience to surface session creation, invitations, latency indicators, and fallback to save-state sync. Include accessibility-friendly status messaging.
- Add automated tests: unit tests for session lifecycle, integration smoke tests simulating host/peer negotiation, and frontend component tests verifying UI states. Document manual QA for WebRTC flows including NAT-traversal scenarios via TURN when required.

Open questions to clarify before implementation:
1. Determine TURN/STUN infrastructure strategy for production netplay (self-hosted coturn vs. third-party) and capture any compliance requirements. **Resolved:** see `docs/netplay/turn-stun-strategy.md` for the selected approach, provisioning guidance, and compliance notes.
