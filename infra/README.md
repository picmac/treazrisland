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

All runtime services now share the canonical variables defined in the repository root [`/.env.example`](../.env.example). Copy that file to a private location (for example `.env` or `infra/compose.env`) and override any secrets before running Compose. Secrets—such as database passwords or ScreenScraper credentials—must be injected via environment variables or Docker secrets; never commit plaintext secrets to the repository. For Prometheus bearer authentication, either export `METRICS_TOKEN_FILE=/absolute/path/to/metrics_token` before launching Compose or copy `infra/monitoring/secrets/metrics_token.sample` to `infra/monitoring/secrets/metrics_token` and paste the same value used for `METRICS_TOKEN` in the backend environment file. The tracked sample contains a placeholder so CI can boot, but production stacks **must** override it. When running the production stack export `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` so Grafana rotates its default credentials on boot.

## Local development stack

Build and start the full stack (migrations, MinIO buckets, and platform seeds run automatically):

```bash
docker compose -f infra/docker-compose.yml up --build
```

To iterate on code without rebuilding containers, launch only the dependencies and run the apps on the host machine:

```bash
docker compose -f infra/docker-compose.yml up postgres minio
```

Ensure your host `.env`, `backend/.env`, and `frontend/.env.local` files mirror the Docker defaults so the services share the same credentials. Use `scripts/health/check-stack.sh` or `scripts/smoke/local-stack.sh` (with `STACK_FILE=infra/docker-compose.yml DB_SERVICE=postgres`) to verify the stack after Compose finishes booting.

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
