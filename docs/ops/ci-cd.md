# Home CI/CD Pipeline Playbook

This runbook documents the exact steps required to operate TREAZRISLAND’s hybrid GitHub Actions + self-hosted deployment pipeline. Every instruction below has been validated against the current repository layout, scripts, and infrastructure manifests so you can reproduce the workflow without guesswork. Pushes to `main` or `develop` always execute the full test matrix in GitHub Actions; only `main` deployments advance to the home server when tests succeed.

## 1. Prepare the Ubuntu host

1. **Create the runner account.** Provision a dedicated Unix user (for example `treaz`) and add it to the `docker` group. Limit sudo to the minimum required for Docker maintenance tasks.
2. **Install Docker Engine and Compose V2.**
   ```bash
   sudo apt update
   sudo apt install -y ca-certificates curl gnupg git
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo systemctl enable --now docker
   docker --version
   docker compose version
   ```
   Ensure `docker compose` returns version **>= v2.20**; the deployment scripts rely on the plugin.
3. **Authorise Git access.** Generate or install an SSH deploy key for the runner user so it can pull `git@github.com:picmac/treazrisland.git`. Test with `ssh -T git@github.com`.
4. **Lay out the application directory.**
   ```bash
   sudo mkdir -p /opt/treazrisland
   sudo chown treaz:treaz /opt/treazrisland
   git clone git@github.com:picmac/treazrisland.git /opt/treazrisland/app
   ```
5. **Prime Node dependencies for tooling.** Although production builds run inside Docker, install dependencies once so Prisma and Playwright assets can be prepared if needed:
   ```bash
   cd /opt/treazrisland/app/backend && npm install
   cd /opt/treazrisland/app/frontend && npm install
   ```

## 2. Provision environment and secrets

Keep runtime secrets out of Git by storing them under `/opt/treazrisland/config` (owned by the runner user, `chmod 640`).

```bash
mkdir -p /opt/treazrisland/config
sudo chown treaz:treaz /opt/treazrisland/config
```

- `/opt/treazrisland/config/backend.env` — populate **every** variable listed in the repository-level `.env.example`: database connection string, JWT secrets, email provider credentials, MinIO/S3 config, ScreenScraper credentials, logging sinks, etc.
- `/opt/treazrisland/config/frontend.env` — mirror the same `.env.example`: API base URL, auth endpoints, public analytics keys, feature flags.
- `/opt/treazrisland/config/compose.env` — values parsed by Docker Compose before containers start. At a minimum configure:
  ```env
  POSTGRES_DB=treazrisland
  POSTGRES_USER=treazrisland
  POSTGRES_PASSWORD=<strong database password>
  MINIO_ROOT_USER=<random admin>
  MINIO_ROOT_PASSWORD=<long random secret>
  GRAFANA_ADMIN_USER=<grafana admin>
  GRAFANA_ADMIN_PASSWORD=<grafana admin password>
  METRICS_ALLOWED_CIDRS=127.0.0.1/32,172.16.0.0/12
  # Optional override if Prometheus should scrape a different DSN
  # POSTGRES_EXPORTER_SOURCE=postgresql://user:pass@postgres:5432/treazrisland?sslmode=disable
  ```
  Add any additional overrides consumed by `infra/docker-compose.prod.yml` here (for example different project names or monitoring network CIDRs).

### Monitoring secrets

Create the Prometheus bearer token expected by the compose file:

```bash
cp /opt/treazrisland/app/infra/monitoring/secrets/metrics_token.sample /opt/treazrisland/app/infra/monitoring/secrets/metrics_token
openssl rand -hex 32 | sudo tee /opt/treazrisland/app/infra/monitoring/secrets/metrics_token >/dev/null
sudo chown treaz:treaz /opt/treazrisland/app/infra/monitoring/secrets/metrics_token
chmod 600 /opt/treazrisland/app/infra/monitoring/secrets/metrics_token
```

## 3. Know the deployment assets

- `infra/docker-compose.prod.yml` defines the production stack: Postgres, MinIO, backend, frontend, and the full observability suite (Prometheus, Alertmanager, Grafana, node-exporter, cAdvisor, postgres-exporter). It references the env files and secrets prepared above.
- `scripts/deploy/deploy-local.sh` executes the deployment end-to-end: fetches `origin/main`, rebuilds Docker images with `--pull`, applies the compose stack, runs Prisma migrations, and optionally seeds platform data when `TREAZ_RUN_PLATFORM_SEED=true`. The script maintains a manifest of health probes for the external services (`postgres`, `minio`, `backend`, `frontend`) and executes them with configurable retries/backoff. Use `TREAZ_HEALTH_MAX_ATTEMPTS` and `TREAZ_HEALTH_BACKOFF_SECONDS` to adjust the retry window when running on slower hardware.
- `scripts/ci/run-tests.sh` mirrors the CI workflow locally (`npm ci`, `npm run lint`, `npm test -- --run`, `npm run build` for both backend and frontend).
- `.github/workflows/ci.yml` ties everything together: the `lint-test-build` matrix runs on GitHub-hosted runners for every push/PR targeting `main` or `develop`; the `deploy` job triggers only for pushes to `main` after the matrix succeeds.

## 4. Register the self-hosted GitHub runner

1. **Download the latest runner release.** Substitute the newest tag from <https://github.com/actions/runner/releases> where shown below.
   ```bash
   mkdir -p /opt/github-runner && cd /opt/github-runner
   RUNNER_VERSION=2.309.0 # example – replace with current latest
   curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
   tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
   ```
2. **Configure the runner.** Use a descriptive name and the `treaz-home` label expected by the workflow.
   ```bash
   ./config.sh \
     --url https://github.com/picmac/treazrisland \
     --token <registration-token> \
     --name treaz-home-runner \
     --labels treaz-home \
     --work _work
   ```
3. **Install the service.**
   ```bash
   sudo ./svc.sh install treaz
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```
4. **Verify connectivity.** In the GitHub UI (`Settings → Actions → Runners`) confirm the runner shows as **Online**, with the `self-hosted`, `Linux`, `X64`, and `treaz-home` labels.

## 5. Validate Docker access for the runner

Run the following as the runner user to ensure the service account can control Docker and execute the deployment script:

```bash
docker info
cd /opt/treazrisland/app
chmod +x scripts/deploy/deploy-local.sh
TREAZ_BACKEND_ENV_FILE=/opt/treazrisland/config/backend.env \
TREAZ_FRONTEND_ENV_FILE=/opt/treazrisland/config/frontend.env \
TREAZ_COMPOSE_ENV_FILE=/opt/treazrisland/config/compose.env \
TREAZ_COMPOSE_PROJECT_NAME=treazrisland \
scripts/deploy/deploy-local.sh
```

> ⚠️ The script resets unhealthy stacks with `docker compose down -v` when `TREAZ_RESET_ON_FAILURE` (default `true`) is set, which erases Postgres and MinIO volumes. Override `TREAZ_RESET_ON_FAILURE=false` for investigative runs where you need to preserve data.

The first execution will build all images. If you are bootstrapping a fresh database, rerun with `TREAZ_RUN_PLATFORM_SEED=true` after the stack is healthy.

## 6. Wire secrets into the runner environment

The GitHub workflow passes `TREAZ_BACKEND_ENV_FILE`, `TREAZ_FRONTEND_ENV_FILE`, `TREAZ_COMPOSE_ENV_FILE`, and `TREAZ_COMPOSE_PROJECT_NAME` to the deployment script. Double-check that:

- Those files exist and are readable by the runner service.
- Sensitive environment editing happens with shell history disabled (`HISTCONTROL=ignorespace` or editing via `nano`/`vim`).
- Additional secrets referenced by `backend.env`/`frontend.env` (ScreenScraper keys, Postmark tokens, OAuth secrets) are set and rotate per security policy.

## 7. Understand the GitHub Actions workflow

`./.github/workflows/ci.yml` currently runs the following:

1. **`lint-test-build`** (matrix of `backend`, `frontend`) on GitHub-hosted Ubuntu runners for pushes to `main` and `develop`, plus all pull requests.
   - `npm ci`
   - `npm run lint`
   - `npm test -- --run`
   - `npm run build`
2. **`deploy`** on the self-hosted `treaz-home` runner for successful pushes to `main` only.
   - Checks out the repo with full history (`fetch-depth: 0`).
   - Exports the env file paths mentioned earlier.
   - Calls `scripts/deploy/deploy-local.sh`.

If any matrix job fails, the deploy job is skipped automatically. GitHub’s branch protection should require the matrix to finish before merging to `main`.

## 8. Operate the deployment script manually

Manual redeployments (e.g., after rotating secrets or updating Docker images) should mimic the workflow run:

```bash
cd /opt/treazrisland/app
TREAZ_BACKEND_ENV_FILE=/opt/treazrisland/config/backend.env \
TREAZ_FRONTEND_ENV_FILE=/opt/treazrisland/config/frontend.env \
TREAZ_COMPOSE_ENV_FILE=/opt/treazrisland/config/compose.env \
TREAZ_COMPOSE_PROJECT_NAME=treazrisland \
scripts/deploy/deploy-local.sh
```

- Override the compose file by setting `COMPOSE_FILE=/path/to/override.yml` before calling the script if you need to test alternative manifests.
- Seed reference platform data once per environment with `TREAZ_RUN_PLATFORM_SEED=true`.
- Health checks fail fast when `postgres`, `minio`, `backend`, or `frontend` stay unhealthy. By default (`TREAZ_RESET_ON_FAILURE=true`) the script performs a full reset with `docker compose down -v` and one additional retry, which wipes Postgres/MinIO volumes. Set `TREAZ_RESET_ON_FAILURE=false` if you cannot afford the wipe and will handle remediation manually.

## 9. Monitoring and troubleshooting

- **Runner service logs:** `journalctl -u 'actions.runner.picmac-treazrisland.treaz-home-runner.service' -f` (adjust the unit name if you chose a different runner label).
- **Workflow diagnostics:** Inspect `/opt/github-runner/_diag/` and the GitHub Actions UI for each run.
- **Container health:**
  ```bash
  docker compose -f infra/docker-compose.prod.yml ps
  docker compose -f infra/docker-compose.prod.yml logs backend
  docker compose -f infra/docker-compose.prod.yml logs frontend
  docker compose -f infra/docker-compose.prod.yml logs prometheus
  docker compose -f infra/docker-compose.prod.yml logs grafana
  ```
- **Database migrations:** `docker compose -f infra/docker-compose.prod.yml exec backend npx prisma migrate status`.
- **Service checks:** Hit `http://localhost:3000` (frontend), `http://localhost:3001/health` (backend), `http://localhost:9090/-/ready` (Prometheus), and `http://localhost:3002` (Grafana) from the host.
- **Metrics token issues:** Ensure `infra/monitoring/secrets/metrics_token` exists, has correct permissions, and matches Prometheus’ expectations.

## 10. Optional notifications

For push notifications when the self-hosted deployment completes:

1. Install GitHub Mobile and sign in with the deployment account.
2. Enable **Settings → Notifications → Actions → Workflow run completed**.
3. Watch `picmac/treazrisland` so Actions notifications arrive on the device.
4. Optionally follow individual workflow runs via the bell icon inside the Actions run view for temporary monitoring.

Email notifications can be configured under **Settings → Notifications** in the web UI for redundancy.

## 11. Security hygiene

- Rotate JWT, Postmark, MinIO, ScreenScraper, and Grafana credentials regularly.
- Keep Ubuntu patched (`sudo unattended-upgrade` or monthly `sudo apt upgrade`).
- Restrict exposed ports via a firewall or reverse proxy (typically only 80/443 externally; 3000/3001/3002/9000/9001/9090/9093 remain internal).
- Back up Docker volumes (`postgres-data`, `minio-data`) and monitoring configs using scheduled `pg_dump`, MinIO `mc mirror`, or volume snapshots.
- Audit runner permissions quarterly to ensure only intended users have sudo and SSH access.

Following this playbook ensures the CI matrix, deployment pipeline, and observability stack remain in lockstep with the repository scripts so every `main` push promotes successfully to your home infrastructure.
