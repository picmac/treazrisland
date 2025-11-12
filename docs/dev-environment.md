# Treazr Island Development Environment

This guide standardises the local development toolchain so that future bootstrap automation (for example, `./scripts/bootstrap.sh`) behaves consistently across macOS and Linux hosts.

## Required tool versions

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.14.0 (LTS) | Aligns with current pnpm compatibility and will be enforced via asdf and the `package.json` `engines` field. |
| pnpm | 9.5.0 | Matches pnpm releases verified against Node.js 20. |
| Docker Desktop / Docker Engine | 26.1.x | Required for the forthcoming bootstrap script that builds and starts containers. |
| PostgreSQL | 16.3 | Matches the target production major version; use either local binaries or Docker image `postgres:16`. |
| Redis | 7.2.4 | Matches the cache layer the services are designed to run against. |

> **Tip:** If you are using asdf, these versions are pinned in `.tool-versions`. Adjustments to production or staging infrastructure should be reflected here to keep environments aligned.

## macOS setup

1. Install [Homebrew](https://brew.sh/) if it is not already available.
2. Install and configure asdf (recommended) or direct runtimes:
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
   The `asdf install` command reads `.tool-versions` and installs the pinned Node.js, pnpm, PostgreSQL, and Redis versions.
3. Install Docker Desktop 26.1.x from [Docker](https://docs.docker.com/desktop/install/mac-install/). Ensure Rosetta is enabled on Apple Silicon if required by dependencies.
4. Verify the toolchain prior to running project automation:
   ```bash
   node --version
   pnpm --version
   docker version
   postgres --version
   redis-server --version
   ```
5. Once all tools report the expected versions, execute the bootstrap script to validate compatibility:
   ```bash
   ./scripts/bootstrap.sh
   ```
   This run ensures the pinned runtimes and Docker services integrate correctly.

## Linux (Ubuntu LTS) setup

1. Install asdf (or your preferred version manager) and prerequisite packages:
   ```bash
   sudo apt update
   sudo apt install -y curl git build-essential libssl-dev zlib1g-dev
   git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0
   echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
   echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc
   source ~/.bashrc
   ```
2. Add the project plugins and install the pinned versions:
   ```bash
   asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
   asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git
   asdf plugin add postgres https://github.com/smashedtoatoms/asdf-postgres.git
   asdf plugin add redis https://github.com/smashedtoatoms/asdf-redis.git
   asdf install
   ```
3. Install Docker Engine 26.1.x following [Docker's Ubuntu guide](https://docs.docker.com/engine/install/ubuntu/) and enable user-level access:
   ```bash
   sudo usermod -aG docker "$USER"
   newgrp docker
   docker version
   ```
4. Confirm tool versions align with the table above by running the same verification commands as in the macOS section.
5. Run the bootstrap automation to ensure host compatibility:
   ```bash
   ./scripts/bootstrap.sh
   ```

## Keeping the environment updated

- When infrastructure requirements change, update `.tool-versions`, `package.json` `engines`, and this document in the same commit.
- After updating any version, validate `./scripts/bootstrap.sh` on both macOS (Intel and Apple Silicon) and Ubuntu LTS to prevent drift.
- Document successful validation runs in PR descriptions as part of the "Documentation Drift" checks outlined in `docs/perfect_start_checklist.md`.

## JavaScript and TypeScript tooling

The repository standardises code quality tooling across the monorepo root so that frontend and backend packages stay aligned.

### Editor and formatting configuration

- `.editorconfig` enforces UTF-8 encoding, LF line endings, two-space indentation, and trailing newline insertion across supported editors.
- `.prettierrc` aligns Prettier behaviour (print width, quote style, trailing commas) between contributors to minimise diff noise.

### Linting and formatting commands

Install dependencies with pnpm to pick up the ESLint and Prettier configuration:

```bash
pnpm install
```

Available scripts:

- `pnpm lint` — runs ESLint across `backend` and `frontend` TypeScript/JavaScript sources with zero tolerated warnings.
- `pnpm format` — formats common source and config files in place using Prettier.
- `pnpm format:check` — verifies formatting without writing changes (used by automated checks).

> **Tip:** Run `pnpm format` before committing to keep diffs lean; CI and the pre-commit hook will use `pnpm format:check`.

### Husky git hooks

- Husky is installed as a development dependency and initialised via the automatic `prepare` script after `pnpm install`.
- The `.husky/pre-commit` hook runs `pnpm lint` and `pnpm format:check`. Commits will fail until lint and formatting pass locally, preventing inconsistent code from entering the repository.
- If Git hooks are not running (for example after cloning), run `pnpm install` or `pnpm exec husky install` to reinstall them.
