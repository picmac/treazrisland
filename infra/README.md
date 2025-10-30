# Infrastructure Assets

Target location for Docker Compose definitions, deployment manifests, and infrastructure automation supporting the self-hosted TREAZRISLAND stack.

## Secrets Management

ScreenScraper developer credentials are stored encrypted-at-rest. Generate encrypted blobs with `npm run screenscraper:encrypt` (see `docs/integrations/screenscraper.md`) and commit only the ciphertext. Inject the decryption key (`SCREENSCRAPER_SECRET_KEY`) via your secret manager or deployment pipeline; never store it in plaintext under version control.

## Local Services

Docker Compose files in this directory spin up the full development stack:

- `postgres`: primary database for Prisma migrations.
- `minio`: S3-compatible object storage (ROMs, assets, BIOS archives).
- `pixellab-mock`: Prism-powered mock for PixelLab APIs.
- `backend`: Fastify API container (hot reload via `npm run dev`).
- `frontend`: Next.js dev server with Playwright-friendly settings.

Run the stack:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Each service consumes the `.env.docker` template in its package. Override values using `.env` files or Compose environment variables when promoting beyond local development.

## Home production stack

`docker-compose.prod.yml` mirrors the service list but targets the production stages of each Dockerfile, removes live code mounts, and adds health checks. The file expects you to provide:

- `TREAZ_BACKEND_ENV_FILE` – path to the backend `.env` containing all secrets.
- `TREAZ_FRONTEND_ENV_FILE` – path to the frontend `.env`.
- `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` – exported via shell or an env file loaded before running Compose.

Deployments are orchestrated by `scripts/deploy/deploy-local.sh`, which is invoked from the `deploy` job in `.github/workflows/ci.yml`. Review `docs/ops/ci-cd.md` for the full setup and operations checklist.
