# Observability Guide

TREAZRISLAND emits structured JSON logs via Pino and exposes a comprehensive Prometheus metric surface that feeds the bundled Grafana dashboards.

## Structured Logging

- `rom.upload` / `bios.upload`: emitted on every archive processed (status `success`, `duplicate`, or `failed`). Includes audit ID, checksum, and platform metadata.
- `rom.enrichment.enqueued`: logged whenever an enrichment job is submitted to ScreenScraper.
- `player.activity`: recorded for ROM downloads, asset fetches, and save-state uploads/downloads. Labels include `action`, `romId`, `assetId`, and `playStateId`.
- `security.csp-report`: emitted by the Next.js frontend when browsers POST CSP violation reports to `/app/api/csp-report`. Payload includes the blocked URI, violated directive, source file metadata, client IP (if forwarded headers are present), and the received timestamp. The handler forwards reports to a central observability endpoint when configured, otherwise it logs the sanitized payload locally.

Logs redact `Authorization` headers, cookies, and password fields. Ship them to your centralized log store and retain at least 30 days for forensic analysis.

### CSP report ingestion

Browsers submit CSP violations to `POST /app/api/csp-report`. The handler accepts `application/json` and `application/csp-report` payloads, validates that required fields (such as `violated-directive` and `original-policy`) are present, normalizes the structure, and forwards the event to the observability pipeline.

- Set `OBSERVABILITY_CSP_ENDPOINT` to the HTTPS URL of your log/metrics collector. The route sends a JSON body with the `security.csp-report` structure described above.
- Optionally set `OBSERVABILITY_CSP_TOKEN` to include a `Bearer` token in the outbound request. Leave this unset to rely on network-level ACLs instead.

When the endpoint is not configured (e.g., local development), the handler still logs the sanitized report via `console.info` so security engineers can tail the Next.js logs and investigate anomalies.

## Metrics

Enable metrics by setting `METRICS_ENABLED=true`, providing a `METRICS_TOKEN`, and restricting scrapes to trusted networks via `METRICS_ALLOWED_CIDRS`. Scrape `/metrics` with Prometheus or any OpenMetrics-compatible collector; the Docker Compose manifests wire Prometheus to pass the bearer token automatically. The production and development Compose files also start node-exporter, cAdvisor, postgres-exporter, MinIO metrics, and Grafana so that host/container health is visible alongside application telemetry.

| Metric                                      | Type      | Labels                                   | Description |
| ------------------------------------------- | --------- | ---------------------------------------- | ----------- |
| `treaz_upload_events_total`                 | Counter   | `kind`, `status`, `reason`               | Counts ROM/BIOS upload outcomes, including failure reasons |
| `treaz_upload_duration_seconds`             | Histogram | `kind`, `status`                         | Measures end-to-end upload processing time |
| `treaz_enrichment_requests_total`           | Counter   | `status`                                 | Tracks ScreenScraper job lifecycle (scheduled/succeeded/failed) |
| `treaz_enrichment_job_duration_seconds`     | Histogram | `phase`                                  | Captures queue wait and processing time for enrichment jobs |
| `treaz_enrichment_queue_depth`              | Gauge     | _none_                                   | Current ScreenScraper job backlog |
| `treaz_playback_events_total`               | Counter   | `action`, `status`, `route`, `reason`    | Records playback interactions and audit failures by route |
| `treaz_player_errors_total`                 | Counter   | `operation`, `reason`                    | Counts ROM/download/save-state API failures |
| `treaz_http_request_duration_seconds`       | Histogram | `method`, `route`, `status_code`         | Backend request latency |
| `treaz_prisma_query_duration_seconds`       | Histogram | `model`, `action`, `outcome`             | Prisma ORM query timings |
| `treaz_process_memory_bytes`                | Gauge     | `type`                                   | Node.js process memory usage |
| `treaz_process_event_loop_lag_seconds`      | Gauge     | `stat`                                   | Node.js event loop lag (mean/pXX/max) |
| `treaz_process_handles_total`               | Gauge     | `type`                                   | Active libuv handles and requests |

Compose automatically provisions Grafana using the JSON dashboards stored under `infra/monitoring/dashboards/` and the datasource definitions in `infra/monitoring/grafana/provisioning/`. Dashboards cover:

- **Backend reliability:** request volume, latency percentiles, and 5xx ratio.
- **Upload & enrichment operations:** upload throughput, duration percentiles, queue depth, and job timings.
- **Playback & storage health:** playback interactions, audit failures, player errors, and event-loop lag.
- **Infrastructure overview:** node load, backend RSS, container CPU, and Prisma latency.

To make these dashboards live:

1. Copy `infra/monitoring/secrets/metrics_token.sample` to `infra/monitoring/secrets/metrics_token` and match it to the backend `METRICS_TOKEN`.
2. Export Grafana admin credentials (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`) before running the production Compose stack, or rely on the development defaults (`admin`/`admin`).
3. Ensure MinIO sets `MINIO_PROMETHEUS_AUTH_TYPE=public` (already baked into the Compose manifests) so Prometheus can scrape `/minio/v2/metrics/cluster`.

## Health Checks

- `GET /health`: basic readiness endpoint (returns `{ status: "ok" }`).
- `GET /metrics`: Prometheus metrics (enabled only when `METRICS_ENABLED=true`).

Use dashboards to correlate upload failure spikes with enrichment job queues and playback errors for faster incident response.
