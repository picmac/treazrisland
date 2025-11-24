# Bootstrap guide

## Quickstart

1. Run `scripts/install/local-setup.sh` to clone/update the repo, validate Docker/Node/pnpm, and pull supporting containers.
2. From the repository root, execute `scripts/bootstrap.sh` to template environment files, install dependencies, start containers, and verify service health.

> Both scripts emit color-coded status lines so you can quickly identify successes, warnings, and actionable failures.

## Prerequisites

- Docker Desktop/Engine running with Compose V2 available via `docker compose`.
- Node.js 20.x LTS or newer and pnpm 8+ (install via `corepack enable && corepack prepare pnpm@latest --activate`).
- curl for HTTP health checks.
- Available ports: 5432 (Postgres), 6379 (Redis), 9000 (MinIO), 8080 (emulatorjs), 4000 (backend API), 5173 (frontend Vite dev server).

## What the scripts do

### `scripts/install/local-setup.sh`

- Detects your platform (macOS, Linux, WSL) and runs preflight checks for Git, Docker (daemon + Compose), Node, and pnpm.
- Provides remediation hints (e.g., start Docker Desktop on macOS/WSL, `systemctl start docker` on Linux, upgrade Node/pnpm to the latest LTS).
- Clones the repository (or fast-forwards an existing checkout), then runs `scripts/install/configure-env.sh` and `scripts/install/pull-containers.sh`.

### `scripts/bootstrap.sh`

- Detects your OS for tailored Docker guidance and validates Docker, curl, Node, and pnpm versions before continuing.
- Templates `.env` files from `infrastructure/env` if they are missing.
- Installs Node dependencies via `pnpm install --frozen-lockfile`.
- Starts infrastructure services (Postgres, Redis, MinIO, emulatorjs), waits for container health, and retries emulatorjs at `http://localhost:8080/healthz` until it responds.
- Applies Prisma migrations and seeds the database.
- Starts backend/frontend containers and retries health checks at `http://localhost:4000/health` and `http://localhost:5173/health` (plus the root page) until they respond or the attempts are exhausted.
- Health retries default to 40 attempts with 5-second intervals; override with `BOOTSTRAP_HEALTH_ATTEMPTS` and `BOOTSTRAP_HEALTH_SLEEP` if you need longer startup windows.

## Troubleshooting

- **Docker daemon not running**: Open Docker Desktop (macOS/WSL) or run `sudo systemctl start docker` (Linux). Re-run the script after the daemon reports healthy.
- **Compose missing**: Upgrade Docker or install the Compose V2 plugin so `docker compose version` succeeds.
- **Node/pnpm version errors**: Update to the latest Node.js 20.x LTS and activate pnpm via `corepack enable && corepack prepare pnpm@latest --activate`.
- **Health checks keep retrying**: Increase `BOOTSTRAP_HEALTH_ATTEMPTS`/`BOOTSTRAP_HEALTH_SLEEP`, then inspect logs with `docker compose -f infrastructure/compose/docker-compose.yml logs <service>` for backend/frontend/emulatorjs.
- **Port conflicts**: Stop the conflicting service or adjust exposed ports in `infrastructure/compose/docker-compose.yml`, then re-run the bootstrap.

If a step fails repeatedly, re-run with `set -x` added near the top of the script to print each command and narrow down the issue.
