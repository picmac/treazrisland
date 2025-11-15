#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

log "Ensuring .env files exist..."
copy_env_template "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
copy_env_template "$REPO_ROOT/backend/.env.example" "$REPO_ROOT/backend/.env"

log "Environment configuration complete."
