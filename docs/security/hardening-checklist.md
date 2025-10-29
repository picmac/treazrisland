# TREAZRISLAND Hardening Checklist

This guide enumerates the operational controls required before promoting a TREAZRISLAND stack to staging or production. Pair it with `docs/security/threat-model.md` and the Coding Agents Playbook when reviewing new changes.

## Authentication & Rate Limiting

- [ ] `JWT_SECRET` rotated before each major release and stored in a secrets manager (Vault, SSM, Doppler). Never reuse the default values from `.env.example` or `.env.docker`.
- [ ] Default rate limits (`RATE_LIMIT_*`) tuned for expected traffic. Admin auth endpoints must stay at `≤5` requests/minute to prevent credential stuffing.
- [ ] `/auth/login`, `/auth/refresh`, and `/admin/*` routes exercised with lockout scenarios to ensure structured logs capture IP, user agent, and status.

## Secrets & Key Management

- [ ] PixelLab and ScreenScraper API tokens rotated every 90 days; replacement values stored outside the codebase.
- [ ] `METRICS_TOKEN` set to a long, random value and distributed only to observability tooling.
- [ ] Audit access to the object storage credentials (`STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`). Keys must be scoped to the TREAZ buckets with read/write but no delete permissions unless lifecycle policies exist.

## Storage Validation

- [ ] MinIO/S3 buckets created with versioning and server-side encryption enabled. ROM and asset buckets enforce MIME filtering where supported.
- [ ] Upload pipelines verified with malicious archive samples; antivirus or sandbox scan results captured in release notes.
- [ ] Retention policies applied to `/roms/uploads` audit tables and corresponding storage prefixes to prevent unbounded growth.

## Observability & Metrics

- [ ] `/metrics` endpoint exposed only on internal networks or behind an authenticated scrape job using `METRICS_TOKEN`.
- [ ] Log shipping pipelines confirm that sensitive headers (Authorization, cookies, passwords) are redacted by Fastify/Pino serializers.
- [ ] Prometheus (or compatible) alerts configured for upload failure spikes, enrichment queue backlog, and playback error rates.

## Change Management

- [ ] CI pipeline (`.github/workflows/ci.yml`) succeeds on lint, unit tests, and build steps for both frontend and backend packages.
- [ ] Release notes updated with manual runbooks for seeding, enrichment, and PixelLab provisioning.
- [ ] Regression screenshots in `docs/qa/` refreshed when UI flows change.
