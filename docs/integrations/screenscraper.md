# ScreenScraper Integration

This document captures how TREAZRISLAND integrates with [ScreenScraper](https://www.screenscraper.fr/) for ROM metadata and artwork enrichment. It mirrors the feature set provided by ES-DE while respecting our security and privacy guardrails.

## Capabilities

* **ROM metadata enrichment** – Title, synopsis, developer, publisher, genre, player count, release year, and rating fields are imported into `Rom` and `RomMetadata` records.
* **Artwork ingestion** – Cover art, wheels, marquees, screenshots, videos, manuals, and maps are modelled in `RomAsset`. The enrichment job only persists assets that improve on existing ScreenScraper-derived media.
* **Job tracking** – Every enrichment run is recorded in `RomEnrichmentJob` with status transitions (`PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`) and provider identifiers.
* **Per-admin preferences** – Admins can persist language/region priority, media selection, and quality rules in `ScreenScraperSettings`. User-level overrides blend with environment defaults at runtime.
* **Caching & rate limiting** – Responses are cached in `ScreenScraperCacheEntry` for six hours. Requests flow through an in-memory queue that enforces the configured concurrency and per-minute quota.

## Configuration

Populate the ScreenScraper section in `.env` (derived from `.env.example`):

```env
SCREENSCRAPER_USERNAME=
SCREENSCRAPER_PASSWORD=
SCREENSCRAPER_SECRET_KEY=
SCREENSCRAPER_DEV_ID_ENC=
SCREENSCRAPER_DEV_PASSWORD_ENC=
SCREENSCRAPER_BASE_URL=https://www.screenscraper.fr/api2
SCREENSCRAPER_REQUESTS_PER_MINUTE=30
SCREENSCRAPER_CONCURRENCY=2
SCREENSCRAPER_TIMEOUT_MS=15000
SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY=en,fr
SCREENSCRAPER_DEFAULT_REGION_PRIORITY=us,eu,wor,jp
SCREENSCRAPER_DEFAULT_MEDIA_TYPES=box-2D,box-3D,wheel,marquee,screenshot,titlescreen
SCREENSCRAPER_ONLY_BETTER_MEDIA=true
SCREENSCRAPER_MAX_ASSETS_PER_TYPE=3
```

* `SCREENSCRAPER_SECRET_KEY` is a high-entropy string (>= 32 chars) stored outside version control. It decrypts the encrypted developer credentials at runtime.
* `SCREENSCRAPER_DEV_ID_ENC` and `SCREENSCRAPER_DEV_PASSWORD_ENC` contain AES-256-GCM encrypted blobs. Do **not** commit plaintext developer credentials.
* Operators may customise the defaults (language, region, media types, quotas). Admin overrides are stored in the database and merged at runtime.

## Encrypting developer credentials

Use the helper script in the backend package to encrypt the developer ID/password:

```bash
cd backend
npm run screenscraper:encrypt -- --secret="<secret>" --value="muldjord"
# Copy the output into SCREENSCRAPER_DEV_ID_ENC

npm run screenscraper:encrypt -- --secret="<secret>" --value="uWu5VRc9QDVMPpD8"
# Copy the output into SCREENSCRAPER_DEV_PASSWORD_ENC
```

If `--value` is omitted the script prompts interactively. When `--secret` is omitted it reads `SCREENSCRAPER_SECRET_KEY` from the environment.

## API surface

The Fastify server exposes admin-only endpoints after configuration:

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/screenscraper/status` | Returns configuration diagnostics and whether the integration is enabled. |
| `GET` | `/admin/screenscraper/settings` | Fetches default, user, and effective settings for the authenticated admin. |
| `PUT` | `/admin/screenscraper/settings` | Persists overrides (language/region priority, media selection, quality rules). |
| `POST` | `/admin/roms/:romId/enrich` | Queues a ScreenScraper enrichment job for the ROM and returns the job payload. |

All routes require an `ADMIN` JWT and leverage the standard `requireAdmin` pre-handler.

## Data model additions

The Prisma schema introduces the following entities to support ScreenScraper:

* `Platform` – Tracks platforms and their ScreenScraper system identifiers.
* `Rom` – Core ROM metadata augmented with ScreenScraper identifiers.
* `RomMetadata` – Provider-specific metadata (one row per provider per ROM).
* `RomAsset` – Rich media assets with language/region metadata and source tracking.
* `RomEnrichmentJob` – Lifecycle tracking for enrichment requests.
* `ScreenScraperSettings` – Persisted admin preferences.
* `ScreenScraperCacheEntry` – Cached API responses for quota-friendly re-use.

Consult `backend/prisma/schema.prisma` for field-level details.

## Operational notes

* Ensure rate limits align with your ScreenScraper tier. Update `SCREENSCRAPER_REQUESTS_PER_MINUTE` and `SCREENSCRAPER_CONCURRENCY` as needed.
* Handle failures gracefully—`RomEnrichmentJob` captures error messages and timestamps for observability.
* Media downloads are not persisted locally; assets reference the ScreenScraper URLs. Object storage integration will hydrate these entries in a future milestone.
* Rotate the developer secret periodically. Because credentials are encrypted at rest, operators can ship encrypted blobs safely with the repository without exposing plaintext secrets.
