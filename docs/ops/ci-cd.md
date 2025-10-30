# Home CI/CD Pipeline Playbook

This runbook describes how to deliver continuous integration and delivery for TREAZRISLAND on a self-hosted Ubuntu box. Follow the steps exactly to ensure that every merge into `main` triggers automated tests in GitHub Actions and, when successful, deploys the production Docker stack on your home server.

## 1. Prepare the Ubuntu host

1. Create a dedicated system user (`picmac`) and add it to the `docker` group. Grant passwordless sudo only if absolutely necessary for Docker maintenance.
2. Install Docker Engine and Compose V2:
   ```bash
   sudo apt update
   sudo apt install -y ca-certificates curl gnupg
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo systemctl enable --now docker
   ```
3. Clone the repository once under `/opt/treazrisland/app` and ensure the working tree is clean:
   ```bash
   sudo mkdir -p /opt/treazrisland
   sudo chown picmac:picmac /opt/treazrisland
   git clone git@github.com/picmac/treazrisland.git /opt/treazrisland/app
   ```
4. Install global dependencies required for one-time tasks:
   ```bash
   cd /opt/treazrisland/app/backend && npm install
   cd /opt/treazrisland/app/frontend && npm install
   ```
   These installs satisfy prerequisites for Prisma migrations and Playwright asset downloads when you later run the stack via Docker.

## 2. Provision environment files

Create `/opt/treazrisland/config` and store secrets outside of Git:

- `/opt/treazrisland/config/backend.env` – contains **all** required backend variables such as `DATABASE_URL`, JWT secrets, Postmark credentials, storage config, ScreenScraper secret key, and observability settings. Use `backend/.env.example` as a checklist.
- `/opt/treazrisland/config/frontend.env` – contains production Next.js variables (auth endpoints, API base URL, public metrics keys, etc.) referenced in `frontend/.env.example`.
- `/opt/treazrisland/config/compose.env` – holds Docker infrastructure secrets that Docker Compose needs at parse time:
  ```env
  POSTGRES_PASSWORD=<secure password>
  MINIO_ROOT_USER=<random admin user>
  MINIO_ROOT_PASSWORD=<long random secret>
  POSTGRES_DB=treazrisland
  POSTGRES_USER=treazrisland
  ```

Set restrictive permissions:
```bash
sudo chown picmac:picmac /opt/treazrisland/config/*.env
chmod 640 /opt/treazrisland/config/*.env
```

## 3. Understand the deployment assets

- `infra/docker-compose.prod.yml` builds the backend and frontend from their production Dockerfile stages and persists Postgres/MinIO data.
- `scripts/deploy/deploy-local.sh` performs the full deployment lifecycle: repository sync, image build, Compose update, migrations, and optional platform seeding.
- `scripts/ci/run-tests.sh` runs the same lint/test/build sequence for backend and frontend that the GitHub matrix job executes.
- `.github/workflows/ci.yml` wires CI and CD together. It runs the Node checks on GitHub-hosted runners and, if the push target is `main`, hands off to the self-hosted runner for deployment.

## 4. Register the self-hosted GitHub runner

1. Download and configure the runner as the `picmac` user:
   ```bash
   mkdir -p /opt/github-runner && cd /opt/github-runner
   curl -o actions-runner-linux-x64-2.329.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
   tar xzf actions-runner-linux-x64-2.329.0.tar.gz
   ./config.sh --url https://github.com/picmac/treazrisland --token <registration-token> --name picmac-home-runner --labels picmac-home --work _work
   ```
2. Install and start the runner service:
   ```bash
   sudo ./svc.sh install picmac
   sudo ./svc.sh start
   ```
3. Confirm the runner appears as **online** in **Settings → Actions → Runners** with the `picmac-home` label. The workflow uses this label for the deploy stage.

## 5. Validate Docker permissions for the runner

Run these commands as `picmac` to prove the runner can control Docker:
```bash
docker info
cd /opt/treazrisland/app
scripts/deploy/deploy-local.sh
```
The dry-run should build the stack and exit successfully. If migrations must be seeded the first time, rerun the script with `TREAZ_RUN_PLATFORM_SEED=true`.

## 6. Wire secrets into the runner environment

The deployment script reads Compose secrets from `/opt/treazrisland/config/compose.env`. Export additional sensitive values (for example, ScreenScraper decrypt keys) directly inside `backend.env` and `frontend.env`. Ensure the GitHub runner service account owns these files and restrict shell history logging when editing them.

## 7. Review the GitHub Actions workflow

The pipeline defined in `.github/workflows/ci.yml` behaves as follows:

1. **`lint-test-build` job** (matrix = `backend`, `frontend`) runs on GitHub-hosted Ubuntu VMs.
   - `npm ci`
   - `npm run lint`
   - `npm test -- --run`
   - `npm run build`
2. **`deploy` job** waits for every matrix run to pass, then executes only for pushes to `main` on the self-hosted runner.
   - Checks out the repository with full history.
   - Calls `scripts/deploy/deploy-local.sh` with environment variables pointing to your config directory.

If any test fails, the deployment job is skipped automatically.

## 8. Operate the deployment script manually (optional)

To redeploy outside CI (for instance, after rotating secrets):
```bash
cd /opt/treazrisland/app
TREAZ_BACKEND_ENV_FILE=/opt/treazrisland/config/backend.env \
TREAZ_FRONTEND_ENV_FILE=/opt/treazrisland/config/frontend.env \
TREAZ_COMPOSE_ENV_FILE=/opt/treazrisland/config/compose.env \
scripts/deploy/deploy-local.sh
```
Set `TREAZ_RUN_PLATFORM_SEED=true` the first time to populate reference data.

## 9. Monitoring and troubleshooting

- Tail runner logs with `journalctl -u actions.runner.picmac-home-runner.service -f`.
- Inspect deployment output through the Actions UI or `/opt/github-runner/_diag/` log files.
- Check container logs:
  ```bash
  docker compose -f infra/docker-compose.prod.yml logs backend
  docker compose -f infra/docker-compose.prod.yml logs frontend
  ```
- Verify Prisma migrations with `docker compose -f infra/docker-compose.prod.yml exec backend npx prisma migrate status`.
- Confirm services are healthy by curling the frontend (`http://localhost:3000`) and backend health endpoints (`http://localhost:3001/health` if exposed).

## 10. Receive local build notifications

You can receive a push notification on your phone when the self-hosted deployment job completes by using the GitHub Mobile app:

1. Install the GitHub Mobile app on iOS or Android and sign in with the `picmac` account.
2. In the app, navigate to **Settings → Notifications → Actions** and enable **Workflow run completed** notifications.
3. Subscribe to the `picmac/treazrisland` repository and ensure **Participating and @mentions** as well as **Watching** notifications are turned on for Actions events.
4. Optional: Within a specific workflow run in the app, tap the bell icon to receive updates for that run only (useful when manually triggering `deploy-local.sh`).

When the local build and deploy job finishes, GitHub will send a push notification through the app. You can also enable email notifications for redundancy via the web UI under **Settings → Notifications**.

## 11. Security hygiene

- Rotate JWT, Postmark, MinIO, and ScreenScraper secrets quarterly.
- Keep Ubuntu patched (`sudo unattended-upgrades` or monthly `apt upgrade`).
- Enforce firewall rules so only necessary ports (80/443 via reverse proxy, 3000/3001 for internal access) are reachable.
- Back up Docker volumes (`postgres-data`, `minio-data`) using `docker run --rm -v` snapshots or scheduled `pg_dump`/`mc mirror` jobs.

Following this runbook yields a production-like CI/CD workflow: GitHub validates every change before merge, and the self-hosted runner promotes successful builds directly onto your home infrastructure.
