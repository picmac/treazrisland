# Netplay signaling integration

Netplay connects TREAZRISLAND players through an external signaling service that brokers session codes and peer discovery. The core application exchanges short-lived session metadata with the service while keeping gameplay streams peer-to-peer.

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `NETPLAY_SERVICE_BASE_URL` | Base URL for the signaling API. Point to the hosted service or the provided mock. | `http://localhost:4100` |
| `NETPLAY_SERVICE_API_KEY` | Static token used for authenticating backend calls to the signaling layer. Rotate frequently in production. | _None_ |
| `NETPLAY_SESSION_DEFAULT_TTL_MINUTES` | TTL applied when clients omit a value. Must be within the min/max bounds. | `60` |
| `NETPLAY_SESSION_MIN_TTL_MINUTES` | Lower bound accepted by the backend when creating sessions. | `5` |
| `NETPLAY_SESSION_MAX_TTL_MINUTES` | Upper bound accepted by the backend when creating sessions. | `360` |
| `NETPLAY_SESSION_CLEANUP_CRON` | Cadence for expiring stale sessions. Align the worker schedule with the cron string. | `*/5 * * * *` |

The backend validates incoming TTLs using the min/max window to prevent long-lived rendezvous rooms. Ensure the signaling provider supports the same constraints.

## API contract

The production integration is expected to expose a REST-style API:

- `POST /v1/sessions` – create a new session, returning a join code and expiration timestamp/TTL.
- `POST /v1/sessions/{sessionId}/participants` – add a participant to an existing session.
- `DELETE /v1/sessions/{sessionId}` – retire a session once all players disconnect or the host cancels.
- `GET /v1/health` – lightweight readiness probe used by TREAZRISLAND health checks.

The WireMock stub bundled with this repository mirrors these routes and returns canned payloads for development.

## Local development

1. Launch the mock container defined in `infra/docker-compose.yml`:
   ```bash
   docker compose -f infra/docker-compose.yml up -d netplay-signal-mock
   ```
2. Point `NETPLAY_SERVICE_BASE_URL` to `http://localhost:4100` (already reflected in `.env.example`).
3. Use any placeholder string for `NETPLAY_SERVICE_API_KEY`; authentication is not enforced by the mock.

## Rate limiting & abuse protection

- Frontend requests that create or join sessions should inherit the existing Fastify rate limiting configuration (see `RATE_LIMIT_*` variables) to reduce the risk of brute-force join code scanning.
- The signaling provider should implement IP- and key-based rate limiting for session creation and participant joins. Align the thresholds with expected gameplay patterns (e.g., tens of requests per minute per host, single digits for joins).
- Monitor repeated join failures or large bursts of session creations; these may indicate enumeration attempts or DDoS precursors.

## TTLs & cleanup

- Client-provided TTLs are clamped between the configured min/max window.
- Expired sessions should be purged by the TREAZRISLAND worker according to `NETPLAY_SESSION_CLEANUP_CRON`; the mock setup assumes a five-minute sweep.
- Providers must also auto-expire sessions server-side to protect against missed cron jobs and ensure resources are reclaimed promptly.

## Security & threat considerations

- Treat `NETPLAY_SERVICE_API_KEY` as a sensitive secret. Store it in a secrets manager for production and rotate when revoking compromised clients.
- Ensure signaling responses do not leak peer IP addresses to unauthorized participants. Only the host and accepted participants should receive connection hints.
- Enforce TLS for production signaling traffic; local mocks may use HTTP.
- Log and alert on unusual session churn or repeated authentication failures as these can precede account takeover attempts.

Additional threat modelling guidance is captured in [`docs/security/README.md`](../security/README.md).

## Observability

Lifecycle logging, metrics, and alerting recommendations for Netplay are documented in [`docs/operations/netplay-observability.md`](../operations/netplay-observability.md).
