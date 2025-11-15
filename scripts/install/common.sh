#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE=${COMPOSE_FILE:-"$REPO_ROOT/infrastructure/compose/docker-compose.yml"}

log() {
  echo "[install] $*"
}

warn() {
  echo "[install][warn] $*" >&2
}

fail() {
  echo "[install][error] $*" >&2
  exit 1
}

ensure_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "Required file not found: ${path#$REPO_ROOT/}"
}

require_command() {
  local command_name="$1"
  local install_msg="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Missing dependency '$command_name'. ${install_msg}"
  fi
}

require_docker() {
  require_command docker "Install Docker Desktop/Engine 26.1.x: https://docs.docker.com/get-docker/."
  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is unavailable. Start Docker and re-run the script."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose v2 is required. Upgrade Docker to a build that ships 'docker compose'."
  fi
}

copy_env_template() {
  local template="$1"
  local target="$2"

  if [[ ! -f "$template" ]]; then
    warn "Template ${template#$REPO_ROOT/} is missing; skipping copy."
    return
  fi

  if [[ -f "$target" ]]; then
    log "${target#$REPO_ROOT/} already exists; leaving as-is."
    return
  fi

  log "Creating ${target#$REPO_ROOT/} from template."
  cp "$template" "$target"
}

ensure_file "$COMPOSE_FILE"
