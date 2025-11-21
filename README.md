# Treazr Island

Treazr Island is an early-stage retro-gaming platform experiment. This repository captures the foundational tooling, infrastructure scaffolding, and planning artefacts that support the MVP.

## Documentation

- [Dependency matrix](docs/dependency-matrix.md) — tracked versions for core tooling and services.
- [GitHub runner setup](docs/github-runner-setup.md) — provision a self-hosted runner for this repository.
- Additional planning notes live in the [`docs/`](docs) directory while the product takes shape.

## Run commands

This monorepo uses `pnpm` (currently pinned to `10.23.x`) for package management. Install the workspace dependencies and run the frontend scaffold with the following commands:

```bash
pnpm install --frozen-lockfile # install dependencies for every workspace package using pnpm-lock.yaml
pnpm --filter frontend dev   # launch the Pixellab-themed Next.js dev server
pnpm --filter frontend build # create a production build of the frontend
pnpm --filter frontend start # serve the production build locally
```

> ℹ️ `pnpm` is the only supported package manager. A `preinstall` guard blocks `npm`/`yarn` executions so the shared `pnpm-lock.yaml` stays authoritative. We intentionally removed `package-lock.json` from the frontend to prevent accidental `npm ci` runs, which conflict with the workspace's `pnpm` layout.
> 🚧 `npm install` may fail with errors like `microbundle: not found` because the workspace relies on pnpm's hoisting strategy. If that happens, rerun `corepack pnpm install --frozen-lockfile` instead of using `npm`.

Additional scripts (linting, formatting, Husky hooks, etc.) are defined in the root `package.json` and automatically cover both the backend and frontend.

## Testing

Use the workspace scripts to validate changes quickly:

- `pnpm lint` — static analysis across backend and frontend packages.
- `pnpm test` — runs Vitest suites in the backend and frontend; coverage reports are emitted to `backend/coverage/` and `frontend/coverage/`.
- `pnpm --filter @treazrisland/playwright test` — executes the Playwright smoke tests in `tests/playwright/` (install browsers first with `pnpm --filter @treazrisland/playwright exec playwright install --with-deps`).

## Quick local setup (curl \| bash)

> ⚠️ **Security warning:** `curl | bash` bypasses your normal code-review flow. Inspect [`scripts/install/local-setup.sh`](scripts/install/local-setup.sh) before running it, or download the script and execute it manually if you are unsure about piping remote content into your shell.

The helper script clones/updates this repository, copies `.env` templates, and pre-pulls/builds the Docker containers referenced by `infrastructure/compose/docker-compose.yml`. Run it from the directory where you want the repo to live:

```bash
TREAZRISLAND_DIR="$HOME/src/treazrisland" \
  curl -fsSL https://raw.githubusercontent.com/treazrisland/treazrisland/main/scripts/install/local-setup.sh \
  | bash -s -- --non-interactive
```

Customize the install by passing `--repo-dir <path>` or `--branch <name>` (or by exporting `TREAZRISLAND_DIR` / `TREAZRISLAND_BRANCH`). After the script finishes, run `./scripts/bootstrap.sh` from the cloned repository to install Node dependencies and start the stack.

`scripts/bootstrap.sh` is the canonical local workflow. It:

1. Templates `.env` files from the canonical samples in `infrastructure/env/*.env.example`.
2. Runs `pnpm install --frozen-lockfile` to hydrate the workspace using `pnpm-lock.yaml`.
3. Applies Prisma migrations and seeds the database via `pnpm --filter backend prisma migrate deploy` and `pnpm --filter backend prisma db seed`.
4. Starts the stack with `docker compose -f infrastructure/compose/docker-compose.yml up -d emulatorjs backend frontend`.
5. Waits for the emulator (`http://localhost:8080/healthz`), backend (`http://localhost:4000/health`), and frontend (`http://localhost:5173/health`) health checks before returning.

## Admin onboarding

Creating the first administrator unlocks the invite- and ROM-management APIs. Run the bootstrap CLI once per environment after the database is migrated.

**Prerequisites**

- `DATABASE_URL` must point at the target Postgres instance (local Docker, staging, etc.).
- Prisma migrations should be applied (`pnpm --filter backend prisma migrate deploy`).

**Usage**

```bash
pnpm --filter backend create-admin            # prompts for the email and password
pnpm --filter backend create-admin --email ops@example.com --password "super-secure"  # non-interactive
```

The script refuses to run if a user already exists, ensuring that exactly one bootstrap admin is created manually.

## Continuous integration

Every push and pull request runs the `CI` workflow, which fans out `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @treazrisland/playwright test`. Branch protection rules require this workflow to succeed before merges land on `main`, so expect to see a green check from GitHub Actions prior to completing a PR.

When the Playwright matrix job runs, GitHub Actions uploads the generated videos, traces, screenshots, and `.log` files from `tests/playwright/artifacts/test-results/` as discrete artifacts (`playwright-videos`, `playwright-traces`, `playwright-screenshots`, `playwright-logs`). Download them from the CI workflow run page's **Artifacts** panel to debug flaky or failing tests without reproducing the run locally.

Older workflow attempts automatically cancel themselves when a newer push or PR update targeting the same branch arrives. This keeps the CI queue responsive and guarantees that only the freshest commit for a branch or pull request finishes executing.

## End-to-end tests

Playwright smoke tests live under `tests/playwright/`. Run them against the Docker Compose stack with:

```bash
pnpm --filter @treazrisland/playwright exec playwright install --with-deps # first run only
pnpm test:e2e
```

The helper script boots the stack, waits for the frontend (`5173`) and backend (`4000`) health checks, runs the suite, and drops screenshots/videos/traces into `tests/playwright/artifacts/test-results/` for inspection.
