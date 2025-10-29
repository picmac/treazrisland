# Operator Runbook

This runbook summarizes the day-2 operations for TREAZRISLAND administrators.

## 1. Bootstrap the Stack

1. Copy `.env.example` to `.env` for local testing, or use `.env.docker` templates for Compose deployments.
2. Install JavaScript dependencies on the host **before** starting Docker Compose so the bind-mounted `node_modules/` folders exist:
   ```bash
   (cd backend && npm install)
   (cd frontend && npm install)
   ```
   This also refreshes the lockfiles when new tooling (e.g., Playwright) is added.
3. Update the following secrets in your secret manager and inject them at runtime:
   - `JWT_SECRET`
   - `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
   - `PIXELLAB_API_KEY` / `PIXELLAB_STYLE_ID`
   - `SCREENSCRAPER_*` credentials (encrypted dev keys plus runtime secret)
   - `METRICS_TOKEN`
4. Launch the infrastructure: `docker compose -f infra/docker-compose.yml up -d`.
5. Run database migrations: `docker compose exec backend npm run prisma:migrate -- --name init` (first boot only).
6. Seed platform metadata: `docker compose exec backend npm run prisma:seed:platforms`.

## 2. PixelLab & Enrichment

1. Generate a PixelLab API key + style ID in the vendor portal.
2. Set the values in the backend environment (`PIXELLAB_API_KEY`, `PIXELLAB_STYLE_ID`, optionally `PIXELLAB_BASE_URL`).
3. Confirm connectivity with the mock or production PixelLab API by hitting `/admin/pixellab/status`.
4. Upload a ROM via `/admin/uploads` and enqueue enrichment:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     http://localhost:3001/admin/roms/<ROM_ID>/enrich
   ```
5. Monitor `treaz_enrichment_requests_total` metrics and backend logs for job completion status.

## 3. Storage Validation

- Ensure MinIO buckets (`treaz-assets`, `treaz-roms`, `treaz-bios`) exist and have versioning enabled.
- Verify upload retention by checking `rom_upload_audit` records after large transfers.
- Rotate object storage credentials quarterly and update the Compose environment.

## 4. Metrics & Health

- Enable `/metrics` by setting `METRICS_ENABLED=true` and `METRICS_TOKEN=<random>`. Scrape from an internal Prometheus instance.
- Health checks:
  - Backend: `GET http://localhost:3001/health`
  - Frontend: `GET http://localhost:3000/api/health` (if exposed)
- Suggested alerts:
  - Upload failure rate > 5% over 10 minutes.
  - Playback audit failures > 0 for five consecutive minutes.
  - Enrichment jobs pending > 20 for more than 15 minutes.

## 5. Release Day Checklist

- Review `docs/releases/mvp.md` for manual steps.
- Capture new screenshots for onboarding, login, library, and admin flows (see `docs/qa/`).
- Verify CI pipeline is green and all migrations have been applied to staging before production promotion.
