# Observability Guide

TREAZRISLAND emits structured JSON logs via Pino and exposes optional Prometheus metrics.

## Structured Logging

- `rom.upload` / `bios.upload`: emitted on every archive processed (status `success`, `duplicate`, or `failed`). Includes audit ID, checksum, and platform metadata.
- `rom.enrichment.enqueued`: logged whenever an enrichment job is submitted to ScreenScraper.
- `player.activity`: recorded for ROM downloads, asset fetches, and save-state uploads/downloads. Labels include `action`, `romId`, `assetId`, and `playStateId`.

Logs redact `Authorization` headers, cookies, and password fields. Ship them to your centralized log store and retain at least 30 days for forensic analysis.

## Metrics

Enable metrics by setting `METRICS_ENABLED=true`, providing a `METRICS_TOKEN`, and restricting scrapes to trusted networks via `METRICS_ALLOWED_CIDRS`. Scrape `/metrics` with Prometheus or any OpenMetrics-compatible collector; the Docker Compose manifests wire Prometheus to pass the bearer token automatically.

| Metric                                | Type      | Labels                           | Description |
| ------------------------------------- | --------- | -------------------------------- | ----------- |
| `treaz_upload_events_total`           | Counter   | `kind`, `status`                 | Counts ROM/BIOS uploads and duplicates/failures |
| `treaz_enrichment_requests_total`     | Counter   | `status`                         | Tracks enrichment job lifecycle (scheduled/succeeded/failed) |
| `treaz_playback_events_total`         | Counter   | `action`, `status`               | Tracks player download/upload interactions |
| `treaz_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Backend request latency |
| `treaz_enrichment_queue_depth`        | Gauge     | _none_                           | Current ScreenScraper job backlog |

## Health Checks

- `GET /health`: basic readiness endpoint (returns `{ status: "ok" }`).
- `GET /metrics`: Prometheus metrics (enabled only when `METRICS_ENABLED=true`).

Use dashboards to correlate upload failure spikes with enrichment job queues and playback errors for faster incident response.
