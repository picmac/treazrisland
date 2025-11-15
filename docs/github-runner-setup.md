# GitHub Runner Setup

This guide walks through provisioning a self-hosted GitHub Actions runner for the `treazrisland/treazrisland` repository. Use it when you need a dedicated machine to execute the CI workflow described in the README, or to run heavier integration tests than the shared GitHub-hosted runners allow.

## Prerequisites

1. **Supported host**: Ubuntu 22.04 LTS (x64) with at least 4 vCPUs, 8 GB RAM, and 30 GB of free disk. Smaller machines tend to swap during Playwright runs.
2. **Network**: Outbound HTTPS (ports 443/80) to `github.com`, `objects.githubusercontent.com`, Docker Hub, and npm registry endpoints. Inbound access is optional unless you need SSH.
3. **System packages**: `curl`, `tar`, `unzip`, `libicu` (needed by the runner) plus Docker Engine with Compose V2, Node.js 20.14, and pnpm 9.5 to match the dependency matrix.
4. **Access token**: A short-lived registration token from **GitHub → Settings → Actions → Runners** for this repository or organization. Keep it secret; anyone with the token can register a runner.
5. **Dedicated user**: Create a system account (for example `actions`) so the runner does not execute CI jobs as `root`.

> 🛡️ Treat the host like a production machine. All repository collaborators can push workflows that run arbitrary commands on it.

## Installation steps

1. **Prepare the host**

   ```bash
   sudo apt-get update && sudo apt-get install -y curl tar unzip libicu70
   sudo mkdir -p /opt/actions-runner && sudo chown actions:actions /opt/actions-runner
   sudo usermod -aG docker actions  # allows workflows to call docker
   ```

2. **Download the latest runner build**

   ```bash
   su - actions
   cd /opt/actions-runner
   RUNNER_VERSION="2.319.1"
   curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
     https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
   echo "<sha256>  actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" | shasum -a 256 -c -
   tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
   rm actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
   ```

   Replace `<sha256>` with the checksum published on the release page.

3. **Install runtime dependencies**

   ```bash
   sudo ./bin/installdependencies.sh
   ```

4. **Register the runner**

   ```bash
   ./config.sh \
     --url https://github.com/treazrisland/treazrisland \
     --token <registration-token> \
     --name ubuntu-runner-01 \
     --labels self-hosted,linux,x64,treazrisland \
     --runnergroup Default \
     --work _work
   ```

   Use a descriptive `--name` so you can identify the host inside GitHub. Labels are optional but help target workflows.

5. **Install and start the service**

   ```bash
   sudo ./svc.sh install actions
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

   The service keeps the runner alive after reboots. Use `sudo ./svc.sh stop` before editing configuration or upgrading.

6. **Validate**
   - Run `./run.sh` once interactively to confirm the runner connects.
   - Push a test branch or rerun the `CI` workflow from the GitHub UI; the job list should show your runner as the executor.

## Keeping toolchains in sync

The CI workflow expects Node.js 20.14 and pnpm 9.5, matching the dependency matrix. Use the NodeSource or Volta installers (or `asdf`) to provision those versions under the `actions` user, and run `pnpm install --global pnpm@9.5.0` if the default install drifts. When you upgrade tooling, update both the host and the pinned versions in `docs/dependency-matrix.md` plus the workflow files.

## Preparing for CI-triggered deployments

Pushes to `main` now trigger a `Deploy to self-hosted runner` job after linting, tests, and dependency security scans succeed. That job targets runners labeled `self-hosted,linux,x64,treazrisland` and calls `pnpm deploy:runner`, which executes `scripts/deploy/self-hosted-runner.sh`. Before allowing the pipeline to manage your host:

1. **Create production `.env` files** — copy `infrastructure/env/root.env.example` to `.env` and `infrastructure/env/backend.env.example` to `backend/.env`, then replace every placeholder with real values (database URLs, JWT secrets, ports, etc.). The deployment script refuses to run until both files exist, preventing accidental default credentials.
2. **Store secrets locally** — keep the `.env` files outside version control (they are already gitignored) and ensure filesystem permissions restrict read/write access to the runner user.
3. **Let GitHub Actions preserve your `.env` files** — the `Deploy to self-hosted runner` job uses `actions/checkout` with `clean: false`, so untracked files such as `.env` and `backend/.env` stay in place between runs. If you manually run `git clean -ffdx` or delete the workspace, recreate the files before the next deploy.
4. **Test the flow manually** — from the repository root, run `pnpm deploy:runner`. The script installs pnpm dependencies, applies Prisma migrations, rebuilds the Docker Compose stack, and waits for the EmulatorJS, backend, and frontend health checks. Verify the services stay healthy before trusting automated deploys.
5. **Monitor the job** — in GitHub → **Actions**, confirm that pushes to `main` show the deploy job targeting `ubuntu-runner-01`. Any failure will surface directly in the workflow logs, so keep an eye on disk space, Docker daemon health, and Prisma migration output.

If you add additional runners, label them with `treazrisland` (or update `.github/workflows/ci.yml`) so the deploy stage continues to target only trusted hosts.

## Upgrading or removing a runner

1. Stop the service: `sudo ./svc.sh stop`.
2. Remove the service: `sudo ./svc.sh uninstall`.
3. Unconfigure from GitHub: `./config.sh remove --token <new-registration-token>`.
4. Delete the directory or untar a newer runner version in place and re-run steps 3–5 above.

## Troubleshooting tips

- If jobs fail before reaching workflow steps, check `/var/log/syslog` for service crashes or `/opt/actions-runner/_diag/` for runner logs.
- Permission errors when invoking Docker usually mean the runner user is not in the `docker` group; log out/in after updating group membership.
- `Resource temporarily unavailable` often points to low memory. Increase swap (`sudo fallocate -l 4G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) or allocate more RAM.
- Use the GitHub UI **Settings → Actions → Runners** to view heartbeats and offline status.
