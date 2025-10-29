# TREAZRISLAND – Product Requirements Document (PRD)

## Document History
- **Version:** 1.0
- **Updated:** 2025-10-29
- **Author:** Codex (AI synthesis from repository analysis)

## Vision & Background
TREAZRISLAND is a self-hosted retro gaming portal that delivers a curated library of classics through a modern web experience. The stack pairs a Next.js SPA with a Fastify REST API, PostgreSQL for persistent data, and object storage (MinIO/S3). A built-in onboarding flow, strict role-based access, and per-user personalization make it ideal for families and homelab crews who want privacy-first retro gaming.

Art direction leans heavily into a 16-bit SNES aesthetic inspired by Monkey Island. Custom hero art, UI embellishments, and promotional visuals are generated on demand via the **PixelLab.ai API**, ensuring stylistic consistency and reproducibility.

## Goals
- Deliver a full self-hosted experience: onboarding, Admin/User roles, secure authentication, and SPA navigation.
- Offer a discoverable library with fast filtering, personal favorites, top lists, and collections.
- Stream ROMs in-browser through EmulatorJS with synchronized play states across devices.
- Keep ROM binaries and assets private via signed URLs, strict JWT enforcement, and rate limiting.
- Provide admins with powerful upload, enrichment, and auditing flows, including integration with external metadata sources.
- Support cooperative play through Netplay sessions and social discovery features.
- Ensure the brand consistently reflects the SNES/Monkey Island vibe by integrating PixelLab.ai powered artwork.

## Non-Goals (Current Scope)
- Cloud-hosted sync, leaderboards, or public multiplayer matchmaking.
- Automatic ROM scraping from third parties; uploads remain user-sourced.
- Native mobile clients; focus remains on a responsive web app.
- Full-featured netplay orchestration (current service is a placeholder with future expansion planned).

## Target Personas
- **Archivist Admin (ROLE: ADMIN):** Manages invitations, uploads, metadata enrichment, and asset curation. Needs comprehensive tooling and audits.
- **Explorer Player (ROLE: USER):** Browses, favorites, and plays games. Expects frictionless auth, responsive UI, and seamless ROM streaming.
- **Homelab Maintainer:** Operates the Docker stack, handles backups, and monitors system health. Requires clear deployment guidance and observability hooks.

## Module Overview
| Module | Purpose | Primary Users | Key Artifacts |
| --- | --- | --- | --- |
| Onboarding & Users | First-run setup, invitations, MFA | Admin | `/onboarding`, `/users/*`, `User`, `UserInvitation` |
| Authentication | Login, refresh, password reset | All | `/auth/*`, `RefreshToken`, `PasswordResetToken` |
| Discovery & Library | Platform grid, search, filters | All | `/platforms/*`, `/roms`, `Rom`, `RomAsset` |
| Game Detail & Player | EmulatorJS canvas, downloads | All | `/play/:id`, `/roms/:id/download`, `/play-states/*` |
| Favorites & Collections | Personalized lists | All | `/favorites/*`, `/collections`, `/top-lists`, `UserRomFavorite` |
| Admin Upload & Enrichment | ROM intake, metadata fetch | Admin | `/roms/upload`, `/roms/:id/enrich`, `UploadAudit` |
| PixelLab Creative Pipeline | Generate SNES-style art | Admin / Maintainer | PixelLab.ai API workflows, CDN cache |
| Netplay | Cooperative sessions | All | `/netplay/*`, `NetplaySession`, `NetplayParticipant` |
| Monitoring & Stats | Usage metrics | All (read), Admin (analysis) | `/stats/overview` |

## Functional Requirements

### 1. Onboarding & User Management
- **First-run flow:** `/onboarding/status` signals whether setup is required; `/onboarding/admin` creates the inaugural ADMIN and issues JWTs.
- **Invitations:** Admins create invitation tokens via `/users/invitations`, controlling role and expiration (`USER_INVITE_EXPIRY_HOURS`, max 30 days). Tokens are stored as argon2 hashes.
- **Self-service signup:** Invitees register through `/auth/signup` with a valid token, applying nickname uniqueness checks.
- **Profile management:** Users can update `nickname` and `displayName` (`PATCH /users/me`) and manage avatars stored in object storage via multipart uploads (PNG/JPEG/WEBP ≤5 MB, validated MIME types).

### 2. Authentication & Security
- **Credential requirements:** Password policy enforces ≥8 characters, at least one uppercase letter and digit. MFA optional but encouraged.
- **Token lifecycle:** Fastify JWT plugin issues short-lived access tokens (`JWT_ACCESS_TTL`, default 15 min) and HttpOnly refresh cookies (`JWT_REFRESH_TTL`, default 30 days). Refresh families rotate per request; logout revokes entire families.
- **Rate limiting:** Global limiter (`RATE_LIMIT_DEFAULT_*`) plus auth-specific caps (`RATE_LIMIT_AUTH_*`).
- **MFA:** TOTP via `otplib`; setup returns secret + hashed recovery codes. Verification and teardown routes enforce rotation on use.
- **Password reset:** Two-step flow (request + confirm) backed by hashed reset tokens and email notifications.
- **CORS & CSP:** Allowlist configured via `CORS_ALLOWED_ORIGINS`. Helmet enforces strict CSP, referrer policy, frameguard, and disables COEP for compatibility. All routes except `/auth/*`, `/onboarding/*`, `/health`, and GET `/rom-assets/*` require JWT.
- **Auditability:** Upload and enrichment actions generate `UploadAudit` entries. Future iterations will extend auditing to auth events.

### 3. Library Discovery
- **Platform grid (`/platforms`):** Combines static metadata (icons, colors) with live counts using Prisma `groupBy`. Integrates personal stats and server metrics for context.
- **Platform detail (`/platforms/:id`):** Allows search, filter by publisher/year, sort by title/year/publisher, and favorites-only toggles. Hero image uses sign-signed asset URLs.
- **ROM catalog (`GET /roms`):** Accepts query params for platform, text search, publisher, year, sort, limit. Returns ROM summaries with curated asset metadata filtered to `COVER`, `VIDEO`, `SCREENSHOT`, `MANUAL`.
- **ROM detail (`GET /roms/:id`):** Supplies full metadata, checksums, asset list, and audit context.

### 4. Game Detail & Emulator
- **Player page (`/play/:id`):** Fetches ROM metadata, handles optional `?token=` seeding, and downloads ROM via JWT-protected endpoint. Exposes stats (platform, size, release year, genre) and toggles for synopsis display.
- **Save states:** `/play-states` offers CRUD with slot support (0–9). Payloads store Base64 buffers and optional JSON metadata. Frontend auto-synchronizes on unload or resume.
- **Asset delivery:** `/rom-assets/:id` streams asset content when authorized via bearer or signed token from `/rom-assets/:id/sign` (default TTL 5 min, `ASSET_TOKEN_TTL` configurable). Manual assets enforce file download with sanitized filenames.
- **Resume handling:** Local resume state stored in browser and cross-synced via `fetchPlayState`. UI indicates resume availability and offers clearing.

### 5. Favorites, Recents & Stats
- **Favorites:** `/favorites/` (GET) and `/favorites/:romId` (POST/DELETE) manage per-user favorites. Conflicts return 204, preventing duplicate errors.
- **Recent activity:** `/play-states/recent` returns latest sessions with embedded ROM metadata and relevant assets for quick resume.
- **Stats overview:** `/stats/overview` aggregates per-user metrics (favorites, save states, uploads, top platforms) and server KPIs (user count, ROM total, storage bytes, active netplay sessions).

### 6. Admin Upload & Enrichment
- **Upload workflow:** `/admin/uploads` dropzone batches hundreds of ROM archives or BIOS packages. Client streams each archive with metadata headers, enforces a 1 GiB cap (`ROM_UPLOAD_MAX_BYTES`), preserves the original filename, and surfaces duplicate or failure states inline. ROM uploads require a platform slug; BIOS uploads target `bios/<core>/` in storage.
- **Storage integration:** Storage service selects Disk or S3/MinIO based on `STORAGE_DRIVER`. Uploads stream to object storage, compute SHA256/SHA1/MD5/CRC32, and persist a `RomBinary` (for ROMs) or `EmulatorBios` (for BIOS) record keyed by the ES-DE-style path. Temporary files are cleaned after persistence.
- **ScreenScraper enrichment:** `/roms/:id/enrich` fetches metadata/assets when ScreenScraper credentials are configured. Respects per-request rate limits (`RATE_LIMIT_ENRICH_*`), caches results, and syncs `Rom.coverUrl` with stored asset ID. Audit records success/failure messages.
- **Admin guardrails:** All upload/enrich routes require `ADMIN` role via `requireRole` pre-handler.

### 7. PixelLab.ai Creative Pipeline
- **Purpose:** Guarantee a cohesive SNES-era visual identity reminiscent of Monkey Island across hero banners, badges, and promotional images.
- **API Integration:**
  - Backend service `PixelLabService` (to be implemented) stores API credentials (`PIXELLAB_API_KEY`, `PIXELLAB_STYLE_ID`) and handles rate limiting.
  - Admin UI exposes tooling to request new art variants (e.g., themed platform banners, campaign posters) directly from PixelLab.ai.
  - Responses (PNG/WebP) are stored in object storage with metadata linking to the originating prompt and style parameters.
- **Usage Scenarios:** 
  - Regenerate hero art on platform detail pages when new ROMs land.
  - Create seasonal artwork (e.g., “TreazFest”) delivered through marketing sliders.
  - Render 16-bit SNES-style NPCs for onboarding, with palettes matching Monkey Island’s warm-cold contrasts.
- **Caching & CDN:** Outputs cached in MinIO and optionally pre-rendered into responsive breakpoints. Future enhancement: integrate with CDN invalidation workflows.

### 8. Netplay
- **Session creation (`POST /netplay/sessions`):** Accepts optional `romId`, TTL (5–360 min), returns join code using a human-friendly alphabet. Persists session and host participant. External integration uses `NetplayService` (currently dummy).
- **Join/Manage:** `/netplay/sessions/join` adds participant and activates session; `/netplay/sessions` lists user’s sessions; `/netplay/sessions/:id` fetches details; DELETE `/netplay/sessions/:id` cancels if requester is host.
- **Frontend:** Netplay page offers host/join forms, session list, status badges, and ability to end sessions. UI also surfaces participant display names/nicknames.
- **Configuration:** Backend pulls `NETPLAY_SERVICE_BASE_URL`, `NETPLAY_SERVICE_API_KEY`, timeout/TTL guardrails, and cleanup cadence from env. Frontend consumes `NEXT_PUBLIC_NETPLAY_SIGNALING_HINT` + TURN relay hints for WebRTC fallback.
- **Security:** Join codes must provide ≥20 bits entropy, expire on first use, and revoke session if the host cancels. Transport security enforced via TLS and API key rotation.
- **Observability:** Emit `netplay.session_created_total`, `netplay.sessions_active`, and structured lifecycle logs to monitor adoption and anomalies.

### 9. API & Documentation
- REST endpoints documented in `docs/API_AUTH.md`, `docs/API_LIBRARY.md`, `docs/API_PLAYER.md`.
- Next.js runtime rewrites `/api/*` and `/rom-assets/*` to the backend, isolating the API to the Docker network.
- CSP reports handled by `/app/api/csp-report` route and logged server-side.
- Investigate future OpenAPI spec export to simplify integrations.

## Data Model Highlights (from `backend/prisma/schema.prisma`)
- **User:** Email, nickname, role, MFA fields, avatar references, relations to uploads, tokens, netplay.
- **Rom:** Title, platform relation, checksum metadata, relations to `RomBinary`, assets, favorites, play states.
- **RomBinary:** One-to-one with `Rom`, tracks storage key, archive metadata, checksum suite, and status flags.
- **EmulatorBios:** Stores BIOS archives per emulator core/region, including storage keys and checksum suite for EmulatorJS cores that require BIOS.
- **RomUploadAudit:** Records action, performer, storage key, checksum info, status (PROCESSING/SUCCEEDED/FAILED), and links back to ROM or BIOS entities.
- **RomAsset:** Type enum (COVER/LOGO/SCREENSHOT/VIDEO/MANUAL/OTHER), format, source URL, storage key.
- **UserRomFavorite & RomPlayState:** Composite primary keys, track personalized relationships.
- **RefreshToken, PasswordResetToken, UserInvitation:** Manage auth token lifecycles securely.
- **NetplaySession & NetplayParticipant:** Manage codes, statuses, roles, external session IDs.

## Infrastructure & Deployment
- **Docker Compose (`docker-compose.yml`):**
  - `db` (PostgreSQL 16) with health check.
  - `adminer` for DB inspection.
  - `minio` for object storage.
  - `backend` Fastify service (Node 22), internal-only via `expose`, environment-driven config for JWT, storage, ScreenScraper, PixelLab (planned).
  - `frontend` Next.js app published on host port 3000 with API rewrites.
  - Optional `cloudflared` profile for Cloudflare Tunnel exposure.
  - Optional `netplay-mock` Prism instance exposing the signaling REST contract at `http://localhost:4011`.
- **Environment variables:** `.env.example` covers JWT secrets, rate limits, storage credentials, ScreenScraper config, Cloudflare token, and will be extended for PixelLab.ai (`PIXELLAB_API_KEY`, `PIXELLAB_STYLE_ID`, optional `PIXELLAB_BASE_URL`).
  - Netplay configuration adds `NETPLAY_SERVICE_BASE_URL`, `NETPLAY_SERVICE_API_KEY`, timeout defaults, session TTL guardrails, cleanup sweep interval, and public frontend hints for WebRTC relays.
- **Build/test scripts:** Backend `npm run dev/build/test`, Frontend `npm run dev/build/test/test:e2e`. Utility scripts generate pixel assets and icon sets.

## Non-Functional Requirements
- **Security:** Strict auth guards, rate limiting, hashed secrets, signed asset tokens, comprehensive Helmet policy, threat model (see `docs/security/threat-model.md`). Storage layer enforces bucket policy and cleans up orphaned temp files.
- **Performance:** Fastify with Prisma ensures low latency; library grids virtualized via `@tanstack/react-virtual`. Upload streaming avoids memory spikes. Rate limits mitigate abuse.
- **Privacy:** API accessible only through frontend proxy; ROM assets locked behind signed URLs; no third-party trackers. PixelLab integration stores only derived assets, not user data.
- **Reliability:** Health endpoint `/health` verifies DB connectivity. Prisma transactions ensure atomic user creation + invitation updates. Upload audits provide traceability for incident response.
- **Accessibility & Responsiveness:** Layout adapts based on orientation hooks; bottom navigation for mobile; follow-up accessibility audit planned.
- **Localization:** Currently English-only; ScreenScraper preferences allow localized metadata. Future i18n expansion noted.
- **Observability:** Structured logging via Fastify logger, upload checkpoints, netplay error logs, CSP report ingestion. Planned integration with centralized logging (e.g., OpenSearch).
  - Netplay service calls emit latency histograms, active session gauges, and join/cancel counters with sanitized join-code hashes.

## Testing & Quality Assurance
- **Backend:** Vitest + Supertest with Testcontainers (PostgreSQL). Requires Docker runtime.
- **Frontend:** Vitest, React Testing Library, User Event, custom pixel-theme lint (`lint:pixel`). Playwright e2e smoke tests verify key auth flows (`docs/testing/e2e.md`).
- **Review process:** `docs/REVIEW_CHECKLIST.md` enforces security, testing, accessibility, and observability criteria before merge.

## Success Metrics
- **Engagement:** DAU/MAU, sessions per user, number of synchronized play states.
- **Library quality:** Total curated ROMs, enrichment coverage, upload success vs. failure ratio.
- **Performance:** LCP < 2.5 s on primary pages, ROM download latency, upload throughput (≤30 s for 256 MB).
- **Security:** MFA adoption rate, blocked rate-limit events, time-to-acknowledge CSP reports.
- **Creative output:** PixelLab render count, approval rate of generated assets, CDN cache hit rate for art.
- **Netplay adoption:** Hosted sessions per week, join success rate, average participants per session.

## Risks & Assumptions
- **ScreenScraper throttling:** External API quotas may limit enrichment throughput; caching mitigates but fallback messaging required.
- **Storage credentials:** Secrets must be rotated securely; migration to managed secret storage planned (Vault/SSM).
- **PixelLab dependency:** API downtime affects timely art generation. Implement retry/backoff and cached fallbacks.
- **XSS concerns:** SPA stores access token in localStorage; CSP + sanitation reduce risk but further hardening (e.g., Trusted Types) recommended.
- **Large ROM uploads:** 1 GiB max per upload; larger libraries require chunked uploads or CLI tooling.
- **Netplay backend:** Dummy integration delays full multiplayer experience; roadmap item for real signaling/relay infrastructure.

## Roadmap & Open Items
1. **PixelLab Service Implementation:** Build backend client, admin UI tooling, caching, and CDN invalidation pipeline for SNES-style assets.
2. **Netplay Evolution:** Integrate real signaling server, WebRTC relay (TURN), and health monitoring of sessions.
3. **Secrets Management:** Shift from `.env` to a managed secret store; automate JWT/PixelLab credential rotation.
4. **Telemetry Expansion:** Forward logs to centralized store, add alerting for auth anomalies and PixelLab API failures.
5. **Admin UX Enhancements:** Bulk enrichment queue management, manual metadata editing, ROM status workflow (pending/approved/rejected).
6. **Community Features (Stretch):** Shared collections, seasonal events with PixelLab-driven art, family safety/age ratings.
7. **Accessibility Audit:** Formal WCAG review, color-contrast validation (especially for pixel themes), keyboard navigation pass.

---

**References:** Compiled from the TREAZRISLAND repository (frontend, backend, docs, Docker setup) as of 2025-10-29, augmented with the required PixelLab.ai creative pipeline integration and rebranded product identity.
