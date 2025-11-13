# Observability

Treazrisland's backend now exposes structured logs and distributed tracing out of the box. This guide explains how to make the most of those signals while developing or debugging the API.

## Structured logging with Pino

- `backend/src/plugins/logger.ts` wires a shared [Pino](https://getpino.io/) instance into Fastify.
- Every request receives a child logger enriched with the `requestId` and resolved route so that correlated messages can be filtered quickly.
- `onRequest` and `onResponse` hooks emit `request received` and `request completed` events that include method, path, status code, and the measured response time.
- The logger level defaults to `debug` in development, `info` in production, and `silent` during tests. Override it explicitly with the optional `LOG_LEVEL` environment variable if you need to reduce or increase verbosity.

When you run the API locally the output is plain JSON so it can be shipped to any log processor or piped through tools such as [`pino-pretty`](https://github.com/pinojs/pino-pretty) if you prefer a colorized view:

```bash
pnpm --filter @treazrisland/backend dev | pnpx pino-pretty
```

### Logging schema

All emitted log lines share the same envelope:

| Field | Description |
| --- | --- |
| `time` | ISO timestamp emitted by `pino.stdTimeFunctions.isoTime`. |
| `level` | [Pino numeric level](https://github.com/pinojs/pino/blob/master/docs/api.md#levels) (e.g., `30` for `info`). |
| `msg` | Human-friendly event label (`request received`, `request completed`, etc.). |
| `service` | Always `treazrisland-backend` so logs stay searchable in multi-service deployments. |
| `env` | Deployment environment derived from `NODE_ENV`. |
| `requestId` | Fastify-generated identifier to correlate all lines for one request. |
| `route` | The resolved Fastify route path; this is safer than using the raw URL because it never contains query parameters. |
| `method` / `url` | HTTP verb and path that triggered the handler. |
| `statusCode` | Present on `request completed` entries, mirrors the HTTP response code. |
| `responseTime` | Duration in milliseconds when Fastify can measure it. |

Request bodies, headers, cookies, and other sensitive payloads are intentionally excluded from logs. The new logger tests in `backend/tests/plugins/logger.spec.ts` assert that secrets such as refresh tokens or authorization headers never appear in serialized log lines, giving the team confidence that compliance requirements are met.

Example `request completed` log:

```json
{
  "level": 30,
  "time": "2024-06-10T12:00:00.000Z",
  "msg": "request completed",
  "service": "treazrisland-backend",
  "env": "development",
  "requestId": "req-abc123",
  "route": "/auth/login",
  "method": "POST",
  "statusCode": 200,
  "responseTime": 42
}
```

## OpenTelemetry tracing

`backend/src/config/observability.ts` bootstraps the OpenTelemetry Node SDK with the Fastify instrumentation as well as the standard Node.js auto-instrumentations. Key behaviors:

- A semantic resource containing the service name (`treazrisland-backend`) and deployment environment is attached to every span.
- When `NODE_ENV=development`, spans are exported to stdout through the `ConsoleSpanExporter`, making it easy to inspect trace timings without any external collector.
- In other environments the instrumentation still runs, so plugging in OTLP exporters later only requires environment variables—no code changes.
- The SDK is started once when the Fastify app is created and automatically shuts down when the server closes.

You will see tracing logs next to regular request logs while running the dev server. Example command:

```bash
pnpm --filter @treazrisland/backend dev
```

Look for `[otel] tracing initialized` in the console to confirm the SDK is running, and you will see JSON spans following each handled request.
