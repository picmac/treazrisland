# Infrastructure Assets

Home for Docker Compose definitions, deployment manifests, and helper scripts that support the self-hosted TREAZRISLAND stack.

## Service catalogue

| Service        | Compose name        | Purpose |
| -------------- | ------------------ | ------- |
| PostgreSQL     | `postgres`         | Primary relational database for Prisma migrations and gameplay metadata. |
| MinIO          | `minio`            | S3-compatible object storage for ROM binaries, BIOS archives, artwork, and save states. |
| Backend        | `backend`          | Fastify API container that mounts the project source during development. |
| Frontend       | `frontend`         | Next.js dev server with Playwright-friendly configuration. |
| Prometheus     | `prometheus`       | Scrapes internal metrics and evaluates alert rules defined in `infra/monitoring/rules/`. |
| Alertmanager   | `alertmanager`     | Routes alert notifications (webhook placeholder by default—replace with your paging system). |
| Grafana        | `grafana`          | Renders the dashboards in `infra/monitoring/dashboards/` and wires the Prometheus datasource automatically. |
| Node Exporter  | `node-exporter`    | Publishes host CPU/memory/load statistics for Prometheus. |
| cAdvisor       | `cadvisor`         | Reports per-container CPU, memory, and filesystem metrics. |
| Postgres exporter | `postgres-exporter` | Exposes database health (connections, WAL, `pg_up`) to Prometheus. |

All services live in [`docker-compose.yml`](./docker-compose.yml). Production overrides are stored in [`docker-compose.prod.yml`](./docker-compose.prod.yml).

### API network isolation

The development stack keeps the Fastify API off the host network. The `backend` service no longer publishes port `3001`; instead
it sits behind an internal bridge network (`backend_private`) that is only shared with the reverse proxies and web frontends
(`frontend`, `nginx`, and `cloudflared`). Supporting dependencies such as PostgreSQL and MinIO stay reachable through the default
network, mirroring a private LAN segment. This layout prevents accidental exposure of administrative endpoints while preserving
the ergonomic developer experience of `docker compose up`.

## Minimal Docker Hub stack

Operators who just want the core experience can use [`docker-compose.simple.yml`](./docker-compose.simple.yml). It launches the
prebuilt backend and frontend images along with PostgreSQL, mounting writable volumes for configuration secrets and library
storage. Secrets such as `JWT_SECRET` and the MFA encryption key are generated automatically on first boot and stored under the
`treaz-config` volume.

```bash
docker compose -f infra/docker-compose.simple.yml up -d
```

The file also includes an optional MinIO service (`--profile object-storage`) when you prefer S3-compatible buckets over the
default filesystem storage.

## Configuration files

All runtime services now share the canonical variables defined in the repository root [`/.env.example`](../.env.example). Copy that file once (for example to `.env` or `infra/compose.env`), override secrets, and optionally symlink it into `backend/.env` and `frontend/.env.local` so every runtime consumes the same source of truth. The default `infra/docker-compose.yml` automatically loads the file referenced by `TREAZ_ENV_FILE` (falling back to `../.env`), so Compose services inherit credentials such as `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, and `METRICS_TOKEN` without duplicating them in the YAML. Secrets—such as database passwords or ScreenScraper credentials—must be injected via environment variables or Docker secrets; never commit plaintext secrets to the repository. For Prometheus bearer authentication, either export `METRICS_TOKEN_FILE=/absolute/path/to/metrics_token` before launching Compose or copy `infra/monitoring/secrets/metrics_token.sample` to `infra/monitoring/secrets/metrics_token` and paste the same value used for `METRICS_TOKEN` in the backend environment file. The tracked sample contains a placeholder so CI can boot, but production stacks **must** override it. When running the production stack export `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` so Grafana rotates its default credentials on boot.

### Database preparation

Before the backend container starts it waits for the `backend-migrate` one-shot job to finish. The helper applies Prisma migrations followed by the platform seed so the admin UI can enumerate systems immediately. You can trigger the job manually (for example after pulling new migrations) with:

```bash
./scripts/infra/migrate-seed.sh
```

The script respects `TREAZ_ENV_FILE`, `TREAZ_COMPOSE_PROJECT_NAME`, and `STACK_FILE` when you need to run against an alternate compose definition. It exits early with actionable errors if the compose file or environment file is missing so self-hosters do not accidentally boot the stack with default credentials.

### Validating Compose manifests

Run `docker compose -f infra/docker-compose.yml config` whenever you tweak the manifests. The command resolves variable substitutions, confirms that `env_file` entries exist, and highlights syntax errors before you attempt to boot the stack. Repeat the same command with `infra/docker-compose.prod.yml` to validate production overrides.

An automated GitHub Action (`docker-compose security`) runs `scripts/ci/check_compose_api_privacy.sh` on every pull request that
touches the Compose files. The helper enforces that the backend service never publishes host ports and that the `backend_private`
network stays marked as `internal: true`, preventing regressions that would re-expose the API outside of the LAN.

## Local development stack

Build and start the full stack (migrations, MinIO buckets, and platform seeds run automatically):

```bash
docker compose -f infra/docker-compose.yml up --build
```

To iterate on code without rebuilding containers, launch only the dependencies and run the apps on the host machine:

```bash
docker compose -f infra/docker-compose.yml up postgres minio
```

Ensure your host `.env` (or whichever file you pass through `TREAZ_ENV_FILE`) is shared with `backend/.env` and `frontend/.env.local` so every service reads identical credentials. Symlinks keep the files in sync. Use `scripts/health/check-stack.sh` or `scripts/smoke/local-stack.sh` (with `STACK_FILE=infra/docker-compose.yml DB_SERVICE=postgres`) to verify the stack after Compose finishes booting.

### Debugging a broken stack

When a Compose service fails to start, run `scripts/infra/debug-stack.sh` to capture container status, health checks, and the most recent log lines for each service. The script respects the same environment overrides as the other helpers (`STACK_FILE`, `TREAZ_COMPOSE_PROJECT_NAME`, and `TREAZ_ENV_FILE`) and accepts `--service`/`--tail` flags to focus on specific containers or expand the log output:

```bash
# Inspect the full stack
scripts/infra/debug-stack.sh

# Only show backend logs with a larger tail
scripts/infra/debug-stack.sh --service backend --tail 200
```

The summary includes restart counts and timestamps so you can pinpoint crash loops quickly, making it easier to share actionable diagnostics when asking for help.

## Production-style stack

`docker-compose.prod.yml` mirrors the service list but targets the production stages of each Dockerfile, removes source mounts, and adds health checks. The production-style workflow now relies on a single environment file that both services share:

1. Copy [`/.env.example`](../.env.example) to `compose.env` (or another filename of your choice) and rotate the placeholder secrets.
2. Export the path once so helper scripts and Docker Compose can consume it:

```bash
export TREAZ_ENV_FILE=/absolute/path/to/compose.env
```

3. (Optional) Override any values inline before launching the stack, for example to rotate the database password:

```bash
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
```

With the environment prepared, bring the stack online:

```bash
docker compose -f infra/docker-compose.prod.yml up -d
```

The single `compose.env` file carries every variable documented in `.env.example`, covering backend, frontend, and infra secrets. Helper scripts and Docker Compose will respect `TREAZ_ENV_FILE`, so per-service files are optional unless you choose to split credentials for a custom deployment.

## Secrets management

ScreenScraper developer credentials are stored encrypted-at-rest. Generate encrypted blobs with `npm run screenscraper:encrypt` inside `backend/` and commit only the ciphertext. Inject the decryption key (`SCREENSCRAPER_SECRET_KEY`) via your secret manager or deployment pipeline.

For end-to-end deployment automation, review `scripts/deploy/deploy-local.sh` and the `deploy` job in `.github/workflows/ci.yml` (documented in `docs/ops/ci-cd.md`).
