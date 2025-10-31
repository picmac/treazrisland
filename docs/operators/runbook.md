# Operator Runbook

This runbook summarizes the day-2 operations for TREAZRISLAND administrators.

Keep the following API references handy when debugging login issues or player data flows:

- [Authentication API](../API_AUTH.md)
- [Player API](../API_PLAYER.md)

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
   - Postmark transactional email secrets (`POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, optional `POSTMARK_MESSAGE_STREAM`)
   - MFA issuer & recovery policy (`MFA_ISSUER`, `MFA_RECOVERY_CODE_COUNT`, `MFA_RECOVERY_CODE_LENGTH`)
  - `SCREENSCRAPER_*` credentials (encrypted dev keys plus runtime secret)
  - `METRICS_TOKEN`
4. Launch the infrastructure: `docker compose -f infra/docker-compose.yml up -d`.
5. Run database migrations: `docker compose exec backend npm run prisma:migrate -- --name init` (first boot only).
6. Seed platform metadata: `docker compose exec backend npm run prisma:seed:platforms`.

## 2. Metadata Enrichment

1. Configure ScreenScraper credentials in the backend environment (`SCREENSCRAPER_DEV_ID`, `SCREENSCRAPER_DEV_PASSWORD`, `SCREENSCRAPER_API_KEY`).
2. Upload a ROM via `/admin/uploads` and enqueue enrichment:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     http://localhost:3001/admin/roms/<ROM_ID>/enrich
   ```
3. Monitor `treaz_enrichment_requests_total` metrics and backend logs for job completion status.

## 3. Storage Validation

- Ensure MinIO buckets (`treaz-assets`, `treaz-roms`, `treaz-bios`) exist and have versioning enabled.
- Verify upload retention by checking `rom_upload_audit` records after large transfers.
- Rotate object storage credentials quarterly and update the Compose environment.

## 4. Metrics & Health

- Enable `/metrics` by setting `METRICS_ENABLED=true`, `METRICS_TOKEN=<random>`, and `METRICS_ALLOWED_CIDRS` to the Prometheus network CIDRs. Scrape from the bundled Prometheus instance or another internal collector that forwards the bearer token.
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

## 6. Email Delivery (Postmark)

- **Provisioning:**
  - Create a dedicated [Postmark Server](https://account.postmarkapp.com/servers) for TREAZRISLAND with an "outbound" message stream.
  - Generate a Server API token and record the From address authorized for the stream.
  - Store the token, from address, and (if customized) the stream name in the platform secret manager under `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, and `POSTMARK_MESSAGE_STREAM`.
- **Configuration:**
  - Set `EMAIL_PROVIDER=postmark` in the backend environment.
  - Validate mail delivery by triggering a password reset in staging. Check Postmark activity for a 200 response and matching metadata.
- **Rotation:**
  - Postmark supports creating additional Server tokens without downtime. Every 90 days:
    1. Create a new Server token in the Postmark UI and stage it in the secret manager as `POSTMARK_SERVER_TOKEN_NEXT`.
    2. Update the backend deployment to read the new token (swap `POSTMARK_SERVER_TOKEN` to the staged value).
    3. Trigger a password reset to confirm delivery, then revoke the previous token in Postmark.
  - Update the `POSTMARK_FROM_EMAIL` sender signature only after verifying the new domain. Deploy the change and perform a live test before decommissioning the old sender.

## 7. Account security & MFA onboarding

- Set sensible defaults for `MFA_ISSUER`, `MFA_RECOVERY_CODE_COUNT`, and `MFA_RECOVERY_CODE_LENGTH` before inviting players. The defaults (`TREAZRISLAND`, `10`, `10`) mirror the production posture but can be customised per deployment.
- Encourage the first administrator to visit **Settings → Multi-factor authentication** immediately after onboarding and to download the issued recovery codes. Pending secrets are wiped automatically if they aren&apos;t confirmed.
- If a user loses access to their authenticator, generate a temporary recovery code via the database or disable MFA with an administrator session using the `/auth/mfa/disable` endpoint.
