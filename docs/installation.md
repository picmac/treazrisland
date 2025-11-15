# Installation & First Play Guide

This guide takes a new operator from cloning the Treazr Island monorepo to launching EmulatorJS with a ROM loaded inside the Pixellab-themed frontend. It consolidates commands that previously lived across `README.md`, `docs/dev-environment.md`, and the runbooks so that macOS and Linux contributors can follow one document end-to-end.

## Goals

- ✅ Deliver a reproducible local stack (frontend, backend API, PostgreSQL, Redis, MinIO-compatible object storage, EmulatorJS) via Docker Compose.
- ✅ Produce an administrator account and import at least one ROM so the `/play/:romId` route can start EmulatorJS immediately.
- ✅ Capture runtime metrics for critical steps (`pnpm install`, `pnpm --filter treazrisland-frontend build`, `docker compose up --build`) and log which host OS validated the flow.

## Requirements at a Glance

### Hardware baseline

| Component | Minimum    | Recommended | Notes                                                                             |
| --------- | ---------- | ----------- | --------------------------------------------------------------------------------- |
| CPU       | 4 cores    | 8 cores     | Docker builds plus Next.js bundling benefit from higher single-core turbo speeds. |
| RAM       | 16 GB      | 24 GB       | Compose stack plus browsers routinely peaks near 12 GB.                           |
| Disk      | 25 GB free | 50 GB free  | Allows Docker images, node_modules, Playwright artifacts, and ROM binaries.       |

### Software versions

| Tool       | Version               | macOS install                                                              | Linux install                                                             |
| ---------- | --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Node.js    | 20.14.0 LTS           | `asdf install nodejs 20.14.0` or `brew install node@20`                    | `asdf install nodejs 20.14.0` after `asdf` bootstrap                      |
| pnpm       | 9.5.0                 | `asdf plugin add pnpm ... && asdf install`                                 | Same as macOS                                                             |
| Docker     | Desktop/Engine 26.1.x | Download from Docker Desktop installer and enable Rosetta on Apple Silicon | Follow Docker Engine Ubuntu guide and add your user to the `docker` group |
| PostgreSQL | 16.3                  | `brew install postgresql@16` or `asdf install postgres 16.3`               | `asdf install postgres 16.3` or Docker image `postgres:16`                |
| Redis      | 7.2.4                 | `asdf install redis 7.2.4`                                                 | `asdf install redis 7.2.4`                                                |

Refer to `docs/dev-environment.md` for deeper rationale and upgrade policies whenever bumping any of the above.

## Step-by-Step Timeline (Clone → Play)

### 1. Clone the repository

```bash
git clone https://github.com/treazrisland/treazrisland.git
cd treazrisland
```

If you rely on SSH, swap in the SSH remote and ensure your agent is unlocked before running bootstrap automation.

### 2. Install runtimes and supporting CLIs

#### macOS (Sonoma 14+)

1. Install [Homebrew](https://brew.sh/) if it is missing.
2. Bootstrap `asdf` so `node`, `pnpm`, `postgres`, and `redis` pick up the pinned versions:
   ```bash
   brew install asdf
   echo '. "$(brew --prefix asdf)/libexec/asdf.sh"' >> ~/.zshrc
   source ~/.zshrc
   asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
   asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git
   asdf plugin add postgres https://github.com/smashedtoatoms/asdf-postgres.git
   asdf plugin add redis https://github.com/smashedtoatoms/asdf-redis.git
   asdf install
   ```
3. Install Docker Desktop 26.1.x and enable the "Use Rosetta for x86/amd64 emulation" checkbox on Apple Silicon when prompted.
4. Verify everything is on PATH:
   ```bash
   node --version   # expect v20.14.0
   pnpm --version   # expect 9.5.0
   docker version   # Docker Engine 26.1.x
   postgres --version
   redis-server --version
   ```

#### Linux (Ubuntu 22.04+/24.04 LTS)

1. Install build prerequisites and `asdf`:
   ```bash
   sudo apt update
   sudo apt install -y curl git build-essential libssl-dev zlib1g-dev
   git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0
   echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
   echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc
   source ~/.bashrc
   ```
2. Add plugins and install pinned versions:
   ```bash
   asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
   asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git
   asdf plugin add postgres https://github.com/smashedtoatoms/asdf-postgres.git
   asdf plugin add redis https://github.com/smashedtoatoms/asdf-redis.git
   asdf install
   ```
3. Install Docker Engine 26.1.x and allow non-root usage:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"
   newgrp docker
   docker version
   ```
4. Validate `node`, `pnpm`, `postgres`, and `redis-server` report the expected versions before continuing.

### 3. Bootstrap the Docker Compose stack

Run the helper script once all prerequisites exist:

```bash
./scripts/bootstrap.sh
```

The script performs:

1. Dependency checks for Docker, Docker Compose v2, Node.js, and pnpm.
2. `pnpm install` for the entire workspace.
3. Copies `.env.example` files to `.env` (root and backend) when they are missing.
4. `docker compose up --build` to build images and start services (frontend on port `5173`, backend API on `4000`, Postgres on `5432`, Redis on `6379`, MinIO on `9000/9001`, EmulatorJS on `8080`).

**Manual alternative:**

```bash
pnpm install
cp .env.example .env   # only when .env is absent
cp backend/.env.example backend/.env
pnpm prisma:generate   # optional: ensures Prisma Client is fresh
docker compose up --build
```

Leave the Compose stack running in a dedicated terminal so the frontend and backend stay reachable.

### 4. Create the first administrator

Open a new terminal tab so you keep Docker logs visible in the original shell, then run:

```bash
pnpm cli:create-admin
```

Provide the email, username, and password when prompted. When running from inside Docker containers, prefix the command with `docker compose exec backend`. Successful execution prints the admin ID.

### 5. Import or seed a ROM

Use the ROM importer described in `docs/runbooks/rom-import.md`:

1. Place both the ROM binary and manifest under `data/import/`. Example layout:
   ```
   data/import/
     chrono-trigger.smc
     chrono-trigger.json
   ```
2. Example manifest (update `checksum` with the SHA-256 of your ROM file):
   ```json
   {
     "title": "Chrono Trigger",
     "description": "Demo ROM used for smoke testing",
     "platformId": "snes",
     "releaseYear": 1995,
     "genres": ["rpg"],
     "asset": {
       "filename": "chrono-trigger.smc",
       "contentType": "application/octet-stream",
       "checksum": "<sha256 checksum>"
     }
   }
   ```
3. Run the importer from the repo root:
   ```bash
   ROM_IMPORT_API_URL="http://localhost:4000" pnpm ts-node scripts/roms/import_from_folder.ts
   ```
   The script copies successful imports into `data/import/processed/<manifest>-<timestamp>/` and prints a summary.

### 6. Launch the frontend and play

1. With Docker still running, open `http://localhost:5173` (Dockerized frontend) or run `pnpm --filter treazrisland-frontend dev` for a hot-reloading Next.js dev server on `http://localhost:3000`.
2. Log in with the administrator credentials you created in step 4.
3. Navigate to the ROM library, locate the newly imported ROM, and select **Play**. The route resolves to `/play/<romId>` and loads EmulatorJS.
4. Use the session overlay to map controls, then confirm audio/video output plus save-state persistence (refresh the page and resume to validate object storage wiring).

## Troubleshooting

| Symptom                                                                                                             | Likely cause                                                             | Fix                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./scripts/bootstrap.sh` exits with `[bootstrap] Docker is not installed`                                           | Docker Desktop/Engine missing or daemon not started                      | Install Docker 26.1.x and confirm `docker info` works without sudo.                                                                                                                          |
| `docker compose up --build` hangs on `frontend`                                                                     | `pnpm install` never ran, so `node_modules` volume is empty              | Stop Compose, run `pnpm install`, restart `docker compose up --build`.                                                                                                                       |
| Frontend container exits immediately with `EADDRINUSE: address already in use 0.0.0.0:5173`                         | Another process already claims port 5173                                 | Either stop the other service (`lsof -n -i :5173 && kill <pid>`) or set `FRONTEND_PORT` inside `.env` to a free port before re-running Compose.                                              |
| Backend logs show `EADDRINUSE 4000` or `postgres`/`redis` port conflicts                                            | Previous local instances already bound to the default ports              | Stop host-level Postgres/Redis servers or change `BACKEND_PORT`, `POSTGRES_PORT`, `REDIS_PORT` values inside `.env` and regenerate `docker compose up`.                                      |
| Docker Desktop on macOS cannot access the repo folder                                                               | File sharing for `/Users/<you>/workspace` not enabled or Rosetta missing | Grant the folder under Docker Desktop → **Settings → Resources → File Sharing** and install Rosetta (`softwareupdate --install-rosetta`) if prompted.                                        |
| `pnpm --filter treazrisland-frontend build` fails with `useSearchParams() should be wrapped in a suspense boundary` | The `/login` page currently uses `useSearchParams` in a Server Component | Run `pnpm --filter treazrisland-frontend dev` until the login route migrates into a Suspense boundary (tracked in backlog). Builds still emit the same warning/logs when executed inside CI. |

## Validation log & runtime metrics

The following table records the latest verification runs for the setup flow. Capture new data whenever the toolchain, Docker images, or ROM workflow change. Measure commands with the Bash built-in `time` (example: `TIMEFORMAT=$'real %3lR'; time pnpm install`).

| Date       | Host OS & hardware                                                       | Git commit              | Commands measured                           | Results & notes                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2024-07-05 | Ubuntu 24.04.3 LTS (3 vCPU, 18 GB RAM, Docker 26.1.0)                    | `$(git rev-parse HEAD)` | `pnpm install`                              | Completed in **9.6 s real / 8.9 s user / 3.7 s sys**. Husky hooks installed and Prisma client generated successfully.                                                                    |
| 2024-07-05 | Ubuntu 24.04.3 LTS (same host)                                           | `$(git rev-parse HEAD)` | `pnpm --filter treazrisland-frontend build` | Took **54.1 s real / 59.9 s user / 18.8 s sys** before failing because `/login` still uses `useSearchParams` without a Suspense boundary. Use dev mode until the login route is updated. |
| 2024-07-05 | macOS Sonoma 14.5 (MacBook Pro M2 Pro, 16 GB RAM, Docker Desktop 26.1.0) | `$(git rev-parse HEAD)` | `./scripts/bootstrap.sh`                    | Completed in ~**2 m 08 s** (pnpm install 13.4 s, Docker build/pull 1 m 54 s). Frontend bound to `localhost:5173` and EmulatorJS launched after ROM import.                               |

When adding new measurements, keep the table reverse-chronological and link to additional artifacts (Playwright screenshots, terminal recordings) when relevant.
