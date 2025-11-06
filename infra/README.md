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

Each application consumes a package-scoped environment template:

- [`backend/.env.docker`](../backend/.env.docker)
- [`frontend/.env.docker`](../frontend/.env.docker)

Edit these files (or provide overrides) before running Compose. Secrets—such as database passwords or ScreenScraper credentials—must be injected via environment variables or Docker secrets; never commit plaintext secrets to the repository. For Prometheus bearer authentication, either export `METRICS_TOKEN_FILE=/absolute/path/to/metrics_token` before launching Compose or copy `infra/monitoring/secrets/metrics_token.sample` to `infra/monitoring/secrets/metrics_token` and paste the same value used for `METRICS_TOKEN` in the backend environment file. The tracked sample contains a placeholder so CI can boot, but production stacks **must** override it. When running the production stack export `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` so Grafana rotates its default credentials on boot.

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

`docker-compose.prod.yml` mirrors the service list but targets the production stages of each Dockerfile, removes source mounts, and adds health checks. It expects you to export the following before running Compose:

```bash
export TREAZ_BACKEND_ENV_FILE=/path/to/backend.env
export TREAZ_FRONTEND_ENV_FILE=/path/to/frontend.env
export POSTGRES_PASSWORD=super-secret
export MINIO_ROOT_USER=treaz-admin
export MINIO_ROOT_PASSWORD=super-secret
```

For quick local smoke tests you can copy [`infra/backend.env.sample`](./backend.env.sample) to `backend.env`, adjust any secrets, and export `TREAZ_BACKEND_ENV_FILE=/absolute/path/to/backend.env` before bringing up the stack. Remember that `docker-compose.prod.yml` reads `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` directly from the host, so export them after copying the sample (for example: `set -a && source backend.env && set +a`) or set them manually before running Compose. Never reuse the sample credentials in shared or production environments.

Then deploy with:

```bash
docker compose -f infra/docker-compose.prod.yml up -d
```

The referenced `backend.env` and `frontend.env` files should contain the same keys documented in `.env.example`, scoped to each service.

## Secrets management

ScreenScraper developer credentials are stored encrypted-at-rest. Generate encrypted blobs with `npm run screenscraper:encrypt` inside `backend/` and commit only the ciphertext. Inject the decryption key (`SCREENSCRAPER_SECRET_KEY`) via your secret manager or deployment pipeline.

For end-to-end deployment automation, review `scripts/deploy/deploy-local.sh` and the `deploy` job in `.github/workflows/ci.yml` (documented in `docs/ops/ci-cd.md`).
