# Observability Guide

TREAZRISLAND emits structured JSON logs via Pino and exposes a comprehensive Prometheus metric surface that feeds the bundled Grafana dashboards.

## Structured Logging

- Fastify emits request-scoped logs for every HTTP call. Each request receives a correlation identifier derived from the incoming `X-Request-Id` header (or generated when absent) that is echoed back on the response and propagated to all downstream logs. Two baseline events accompany every interaction:
  - `request.received`: recorded when Fastify begins processing the request. Includes the correlation ID, method, raw URL, and remote IP.
  - `request.completed`: emitted after the response is sent. Captures status code, resolved route, duration (milliseconds), and response size. Combine this with Loki queries such as `{service="backend"} | json | requestId="<uuid>"` to build end-to-end traces.
- When the global rate limiter rejects a client, the server logs `event: "rate_limit.exceeded"` with the offending route, role, and IP while incrementing the `treaz_rate_limit_exceeded_total` metric surfaced on the Grafana dashboards.

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
- **Rate-limit telemetry:** the "Rate Limit Rejections (5m)" panel surfaces throttled routes broken down by role to spot abusive clients.
- **Upload & enrichment operations:** upload throughput, duration percentiles, queue depth, and job timings.
- **Playback & storage health:** playback interactions, audit failures, player errors, and event-loop lag.
- **Infrastructure overview:** node load, backend RSS, container CPU, and Prisma latency.
- **Log review:** the "Backend Request Logs" panel queries Loki for structured Fastify events with filters for `route`, `statusCode`, and `requestId` labels.

To make these dashboards live:

1. Export `METRICS_TOKEN_FILE=/path/to/metrics_token` before Compose starts **or** copy `infra/monitoring/secrets/metrics_token.sample` to `infra/monitoring/secrets/metrics_token` and match it to the backend `METRICS_TOKEN`. The sample now contains a placeholder to keep ephemeral stacks online, but production must provide the real token.
2. Export Grafana admin credentials (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`) before running the production Compose stack, or rely on the development defaults (`admin`/`admin`).
3. Ensure MinIO sets `MINIO_PROMETHEUS_AUTH_TYPE=public` (already baked into the Compose manifests) so Prometheus can scrape `/minio/v2/metrics/cluster`.

## Health Checks

- `GET /health/live`: liveness probe that returns `{ status: "pass" }` with uptime and build version.
- `GET /health/ready` (alias `/health`): readiness probe that checks Prisma connectivity and observability wiring. It aggregates component checks for the database and metrics subsystem, returning HTTP 503 only when a component reports `status: "fail"`. A degraded dependency returns `status: "warn"` in the payload while keeping the HTTP status at 200 so the service can remain in rotation during partial outages.
- `GET /health/system`: `@fastify/under-pressure` system status (event loop lag, heap usage) for infrastructure probes. The pressure handler reuses the readiness report and only treats `status: "fail"` as unavailable.
- `GET /metrics`: Prometheus metrics (enabled only when `METRICS_ENABLED=true`). When metrics are disabled by configuration the readiness payload includes `{ component: "metrics", details: { enabled: false, reason: "disabled" } }` while still reporting a passing status.

Use dashboards to correlate upload failure spikes with enrichment job queues and playback errors for faster incident response.

## Log aggregation pipeline

- The Compose stacks ship `loki` and `promtail` services. Promtail tails Docker logs via the Unix socket, parses JSON emitted by Pino, and enriches entries with `service`, `event`, `route`, and `statusCode` labels before shipping to Loki.
- Grafana auto-provisions a Loki datasource (`uid: treaz-loki`) and the backend reliability dashboard includes a `Backend Request Logs` panel filtered to `service="backend"`. Filter by `requestId` or `event="rate_limit.exceeded"` to investigate spikes.
- Adjust the promtail stages via `infra/monitoring/promtail-config.yml` if additional containers or custom labels are required.
