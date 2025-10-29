# Netplay Integration Guide

The Netplay integration enables synchronized multiplayer sessions orchestrated by an
external signaling service. This document outlines how to configure the integration,
secure it for self-hosted deployments, and debug common issues.

## Service Overview

- **Role:** Issue join codes, mediate WebRTC/EmulatorJS signaling, and track session lifecycle.
- **Primary consumers:** Backend `NetplayService` (server-to-server) and the frontend Netplay UI.
- **Transport expectations:** HTTPS for REST calls, WSS for realtime relay hints.

## Environment Variables

Set the following variables in your `.env` file (see `.env.example` for defaults):

| Variable | Purpose |
| --- | --- |
| `NETPLAY_SERVICE_BASE_URL` | Base URL for REST calls (`/health`, `/sessions`, `/sessions/join`). |
| `NETPLAY_SERVICE_API_KEY` | Shared secret used to authenticate backend requests. Rotate periodically. |
| `NETPLAY_SERVICE_REQUEST_TIMEOUT_MS` | Upper bound for outbound REST calls from the backend service. |
| `NETPLAY_SESSION_DEFAULT_TTL_MINUTES` | Default session lifespan when the client omits TTL. |
| `NETPLAY_SESSION_MAX_TTL_MINUTES` | Backend guardrail preventing excessively long sessions. |
| `NETPLAY_SESSION_SWEEP_INTERVAL_MINUTES` | Frequency of the background cleanup job that retires expired sessions. |
| `NEXT_PUBLIC_NETPLAY_SIGNALING_HINT` | Frontend hint pointing to the signaling WebSocket/relay endpoint. |
| `NEXT_PUBLIC_NETPLAY_TURN_RELAYS` | Comma-separated TURN URIs exposed to EmulatorJS for NAT traversal. |

### Cleanup cadence guidance

- A five-minute sweep strikes a balance between freeing stale sessions and avoiding noisy churn.
- Tighten the interval (e.g., 2 minutes) when hosting public events where many codes expire quickly.
- Loosen the interval (10+ minutes) only if the signaling service enforces its own TTL to avoid drift.

## Local Development

Run the optional mock service from `infra/docker-compose.yml`:

```bash
docker compose -f infra/docker-compose.yml up netplay-mock
```

The mock implements a small subset of the API described in `infra/mock/netplay-openapi.yaml` and listens on
`http://localhost:4011`. Update your `.env` to point at the mock and seed the frontend hints:

```dotenv
NETPLAY_SERVICE_BASE_URL=http://localhost:4011
NETPLAY_SERVICE_API_KEY=local-dev
NEXT_PUBLIC_NETPLAY_SIGNALING_HINT=ws://localhost:4011
```

## Security Posture & Threat Mitigations

- **API key rotation:** Store the key in a secret manager and rotate when staff changes occur. Monitor failed auth attempts.
- **Join-code entropy:** Ensure the backend issues codes ≥20 bits of entropy (e.g., 10-character base32) to reduce guessability.
- **Session hijacking:** Bind participants to authenticated user IDs and invalidate codes immediately after successful joins.
- **Replay prevention:** Timestamp signed payloads exchanged with the signaling service and reject stale requests.
- **Transport security:** Require TLS for production endpoints and enforce strict CORS for the REST surface.

## Observability Guidance

Instrument the backend with structured logs and metrics that capture Netplay health:

- **Metrics:**
  - `netplay.sessions_active` gauge (labelled by rom/platform).
  - `netplay.session_created_total` counter with `origin=host|join`.
  - `netplay.session_cancelled_total` counter with `reason=host_request|timeout|error`.
  - `netplay.service.latency` histogram derived from REST call durations.
- **Logs:**
  - Session lifecycle events (create, join, cancel) with join-code hash, not plaintext.
  - Authentication failures or expired API keys (include correlation IDs).
  - Cleanup sweep summaries (sessions expired, duration, next scheduled run).

Forward these signals to your existing observability stack (e.g., OpenSearch, Loki, Prometheus) and set alerts on sustained
failure rates or latency spikes.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| HTTP 401 from Netplay API | Verify `NETPLAY_SERVICE_API_KEY` matches the server secret and the clock skew is <30 s. |
| Sessions immediately expire | Confirm TTL inputs do not exceed `NETPLAY_SESSION_MAX_TTL_MINUTES` and cleanup sweep cadence is not overly aggressive. |
| Frontend cannot connect to relay | Double-check `NEXT_PUBLIC_NETPLAY_SIGNALING_HINT` and TURN URIs; ensure WSS certificates are trusted. |
| Mock service unreachable | Ensure `netplay-mock` container is running and port 4011 is free. |

Escalate persistent issues by capturing logs (`netplay.*`) and the raw API responses, then attach them to the support ticket.
