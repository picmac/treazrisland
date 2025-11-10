# Local Stack Playbook

This guide explains how to launch the developer stack defined in the repository root `docker-compose.yml`, seed its data stores, and verify the services before iterating on features.

## 1. Prerequisites

- Docker Engine 24+ with the Compose plugin.
- Node.js 22.21.1 LTS installed locally (only required if you prefer to run the apps on the host).
- The environment variables from `.env.example` copied to a local `.env` file (or exported in your shell).

Install dependencies once so the bind-mounted `node_modules/` folders exist before Compose starts:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## 2. Required environment overrides

Copy `.env.example` to `.env` and replace the following secrets before using the stack in a shared environment or CI pipeline:

- `JWT_SECRET` – generate a random 32+ byte string.
- `MFA_ENCRYPTION_KEY` – 32-byte AES key that protects TOTP secrets.
- `POSTGRES_PASSWORD` – rotate any time you expose the database outside localhost.
- `MINIO_ROOT_PASSWORD` – rotate quarterly; grant least-privilege access to bucket users.
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` – credentials used by the backend to talk to MinIO/S3.
- `METRICS_TOKEN` – bearer token required by `/metrics` when `METRICS_ENABLED=true`.
- `SCREENSCRAPER_*` – never store plaintext credentials; see `docs/operators/runbook.md` for encryption steps.

If you enable transactional email or the production monitoring profile, also provide:

- `POSTMARK_*` secrets for outbound email.
- `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (exported, not stored in `.env`).

## 3. Start the stack

Launch the four core services and their bootstrap jobs:

```bash
docker compose up --build
```

The Compose file performs the following bootstrapping steps automatically:

1. **Database migrations:** `backend-migrate` runs `npm run db:prepare` (repair, migrate, seed) against the `db` service.
2. **Seed data:** the same job upserts the reference platform list via `npm run prisma:seed:platforms`.
3. **MinIO provisioning:** `minio-setup` creates the `treaz-assets`, `treaz-roms`, and `treaz-bios` buckets, attaches lifecycle policies, and reuses the configured credentials.

Each service exposes a health check so Compose waits for readiness before wiring dependencies:

| Service   | Health command                                 |
| --------- | ---------------------------------------------- |
| `db`      | `pg_isready -d treazrisland -U treazrisland`    |
| `minio`   | `curl -f http://localhost:9000/minio/health/ready` |
| `backend` | `curl -f http://localhost:3001/health`          |
| `frontend`| `curl -f http://localhost:3000`                 |

## 4. Validate the deployment

Run the lightweight health sweep:

```bash
scripts/health/check-stack.sh
```

For a fuller smoke test (database seed verification and bucket discovery), run:

```bash
scripts/smoke/local-stack.sh
```

The smoke script confirms that the `Platform` table contains seed data and that each MinIO bucket exists.

## 5. Tear down and reset

To stop the stack but keep volumes:

```bash
docker compose down
```

To nuke the state and force the bootstrap steps to re-run:

```bash
docker compose down -v
```

This removes the PostgreSQL and MinIO volumes so the next `docker compose up` performs a clean migration + seed cycle.
