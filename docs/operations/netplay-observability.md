# Netplay observability playbook

Netplay introduces user-facing lifecycle events that require structured telemetry for debugging, trust & safety, and capacity planning. The following guidance supplements the base logging practices defined in the Coding Agents Playbook.

## Logs

| Event | Log level | Required fields | Notes |
| --- | --- | --- | --- |
| Session creation request sent | `info` | `sessionId` (pre-generated UUID), `romId` (optional), `requestedTtlMinutes`, `initiatorUserId` | Emit before calling the signaling API to trace latency and retries. |
| Session creation response | `info` | `sessionId`, `joinCode`, `ttlMinutes`, `signalingLatencyMs`, `provider` | Include latency to spot slow responses and provider identifier if multiple backends are supported. |
| Participant join | `info` | `sessionId`, `participantUserId`, `result` (`accepted`/`rejected`), `reason` (on failure) | Rate-limited logs may be necessary if the join endpoint becomes noisy. |
| Session termination | `info` | `sessionId`, `reason` (`hostLeft`, `timeout`, `cleanupJob`), `activeParticipants` | Distinguish organic shutdowns from cleanup sweeps. |
| Signaling error | `warn` | `sessionId`, `errorCode`, `providerStatus`, `retryCount` | Escalate to `error` if retries are exhausted. Avoid logging secrets or SDP payloads. |
| Cleanup job summary | `debug`/`info` | `expiredSessions`, `processedAt`, `durationMs` | Elevate to `info` when expiredSessions > 0 to keep an audit trail of automation. |

## Metrics

Expose counters and histograms via the existing metrics backend (e.g., Prometheus):

- `netplay_sessions_created_total` (counter, labelled by `provider` and `result`).
- `netplay_session_duration_minutes` (histogram, labelled by `provider`).
- `netplay_participants_joined_total` (counter, labelled by `result`).
- `netplay_signaling_latency_ms` (histogram, labelled by `provider` and `operation`).
- `netplay_cleanup_sweeps_total` (counter) and `netplay_cleanup_duration_ms` (histogram).

## Alerts

- **Signaling outage:** Trigger if `netplay_sessions_created_total` or participant joins drop to zero for 15 consecutive minutes during peak hours.
- **Join code abuse:** Alert on spikes of failed joins (`result=failed`) exceeding historical baselines.
- **Cleanup failure:** Notify operators if the cleanup job reports non-zero expired sessions for more than two consecutive sweeps.

## Dashboards

Recommended dashboard widgets:

1. Active sessions over time (derived from session creation/deletion metrics).
2. Top error codes returned by the signaling provider.
3. Cleanup sweep durations and expired session counts.
4. Distribution of session TTLs vs configured min/max to spot misconfiguration.

## Tracing

If distributed tracing is enabled, attach trace spans around:

- Outbound calls to the signaling API (`netplay.signaling.create`, `netplay.signaling.join`, `netplay.signaling.delete`).
- Cleanup cron execution (`netplay.cleanup.run`).

Include join codes only in hashed form (`sha256(joinCode)`) to avoid leaking secrets into traces.
