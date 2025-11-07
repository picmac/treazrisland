# TREAZRISLAND MVP Release Notes

**Version:** MVP-1.0.0  
**Release Date:** YYYY-MM-DD

## Highlights

- Fastify backend with structured logging for ROM uploads, ScreenScraper enrichment requests, and playback events.
- Next.js frontend with onboarding, authentication, library explorer, and admin upload dashboards.
- Docker Compose stack bundling Postgres, MinIO, backend, and frontend containers.
- Prometheus-compatible metrics exposed at `/metrics` (disabled by default, enable with `METRICS_ENABLED=true`).

## Breaking Changes

- Backend and frontend environment templates merged into a single `.env` file. Merge existing secrets before upgrading so Docker Compose and local development stay in sync.
- Metrics scraping requires a bearer token via `METRICS_TOKEN`.

## Manual Steps

1. Run `npm install` in both `backend/` and `frontend/` to ensure lockfiles pick up the latest tooling before building release artifacts.
2. Rotate and inject secrets (`JWT_SECRET`, storage credentials) via your secret manager.
3. Seed core platform data: `npm run prisma:seed:platforms` inside the backend container.
4. Populate ROM metadata:
   - Upload ROM/BIOs via `/admin/uploads`.
   - Trigger ScreenScraper enrichment with `/admin/roms/:romId/enrich`.
5. Configure observability:
   - Set `METRICS_ENABLED=true` and `METRICS_TOKEN` to a random value for Prometheus scraping.
   - Point log forwarders at the backend container output (JSON Pino logs).

## Known Issues

- Playwright smoke tests rely on stubbed API responses; end-to-end tests against a real backend are planned.
- Curated art assets must be uploaded manually prior to referencing them in the frontend.

Track mitigations and follow-up tasks in the main backlog after each release.
