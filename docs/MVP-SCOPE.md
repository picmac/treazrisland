# MVP Scope

Quick reference for what must ship in the Treazr Island MVP versus what can wait.

## Vision

Deliver a self-hosted retro hub where an operator can install the stack, invite friends, upload a ROM, and start playing with save-state support within an hour—all wrapped in a polished, accessible, Pixellab-themed UX.

## MVP Features (must-have)

- **Install & bootstrap:** Docker Compose stack with `.env` templates, bootstrap CLI to create the first admin, Prisma migrations + seed, and health checks for API, Redis, MinIO, and EmulatorJS.
- **Auth & invites:** Password + magic link login, invite issuance/redemption with validation, refresh token rotation via HTTP-only cookies, and rate limiting on auth routes.
- **Profiles & avatars:** View/update profile (display name), avatar upload grants backed by object storage, and profile completeness indicators in the UI.
- **Library:** ROM listing with platform/genre/favorites filters, metadata-rich detail view, favorites toggle, and responsive grid. Save-state summary surfaced on detail pages.
- **ROM ingestion:** Admin upload grants (presigned URLs), checksum enforcement, platform/genre normalization, and success/error feedback in the frontend.
- **Play session shell:** Emulator-ready page with control overlays, save/load affordances, and clear status/error indicators for session prep.
- **Observability:** `/health` coverage for Postgres/Redis/object storage, `/metrics` gate with exporter toggle, structured logs, and visible UI toasts/status banners.
- **Quality gates:** ESLint/Prettier/TypeScript + Vitest suites green locally; Playwright smoke path runnable via scripts.

## Nice-to-Have (not required for MVP)

- Netplay/multiplayer orchestration and matchmaking.
- Metadata enrichment from external sources (e.g., ScreenScraper).
- Advanced admin dashboards (analytics, retention, seasonal themes).
- Offline/edge caching strategies and CDN integrations.
- Localization/internationalization of UI copy.

Assumptions are documented inline as TODOs where implementation details are still emerging.
