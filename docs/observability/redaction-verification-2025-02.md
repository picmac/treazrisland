# Log Redaction Verification – 2025-02-14

- **Date:** 2025-02-14
- **Owner:** Nora Blake
- **Goal:** Ensure Fastify/Pino serializers strip sensitive values before shipping logs to the aggregator.

## Method

1. Launched the backend locally with `LOG_LEVEL=trace` and triggered failed login + password reset flows.
2. Captured the emitted JSON lines and inspected the `req.headers` and `req.body` payloads.
3. Compared output to the serializer definition in `backend/src/server.ts` to confirm `Authorization`, `cookie`, and `password` fields are removed.

## Sample Event

```json
{
  "level": 30,
  "time": "2025-02-14T18:52:10.112Z",
  "msg": "POST /auth/login",
  "req": {
    "id": "req-01HXXXXP8M6X3YQ1HV6R2K7X3M",
    "method": "POST",
    "url": "/auth/login",
    "remoteAddress": "10.10.20.45"
  },
  "res": {
    "statusCode": 401
  },
  "err": {
    "type": "Unauthorized",
    "message": "invalid credentials"
  }
}
```

- Headers do **not** include `authorization` or `cookie` keys.
- Request body omits the submitted `password`.

## Outcome

- Redaction configuration validated; log shipper can forward events without additional scrubbing.
- Stored sample event and notes in Elastic stack runbook entry `obsv/log-redaction/2025-02-14`.
- Next verification scheduled after implementing centralized pipeline (**SEC-56**).
