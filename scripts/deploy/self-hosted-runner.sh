#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infrastructure/compose/docker-compose.yml"

log() {
  echo "[deploy] $*"
}

fail() {
  echo "[deploy][error] $*" >&2
  exit 1
}

require_command() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "Missing required command '$name'. ${hint}"
  fi
}

require_file() {
  local path="$1"
  local message="$2"
  if [[ ! -f "$path" ]]; then
    fail "$message"
  fi
}

wait_for_http_health() {
  local name="$1"
  shift
  local urls=("$@")
  local max_attempts=40
  local sleep_seconds=5
  local attempt=1

  if [[ ${#urls[@]} -eq 0 ]]; then
    fail "wait_for_http_health requires at least one URL for $name"
  fi

  log "Waiting for $name health (${urls[*]})..."
  while (( attempt <= max_attempts )); do
    for url in "${urls[@]}"; do
      if curl -fsS "$url" >/dev/null 2>&1; then
        log "$name is healthy (attempt $attempt)."
        return 0
      fi
    done

    log "$name health check attempt $attempt failed. Retrying in ${sleep_seconds}s..."
    ((attempt++))
    sleep "$sleep_seconds"
  done

  fail "$name did not become healthy after $max_attempts attempts."
}

log "Preparing deployment prerequisites..."
require_command pnpm "Install pnpm 10.4.1 (see docs/dependency-matrix.md)."
require_command docker "Install Docker Engine/Desktop 26.1.x."
require_command curl "Install curl via your package manager."

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose v2 is required. Upgrade Docker to a build that bundles 'docker compose'."
fi

require_file "$REPO_ROOT/.env" "Missing $REPO_ROOT/.env. Copy infrastructure/env/root.env.example and populate production secrets before deploying."
require_file "$REPO_ROOT/backend/.env" "Missing $REPO_ROOT/backend/.env. Copy infrastructure/env/backend.env.example and adjust values."

set -a
source "$REPO_ROOT/.env"
set +a

BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
EMULATORJS_PORT="${EMULATORJS_PORT:-8080}"

cd "$REPO_ROOT"

log "Installing workspace dependencies via pnpm..."
pnpm install --recursive --frozen-lockfile

log "Applying Prisma migrations..."
pnpm --filter backend prisma migrate deploy

log "Building and restarting Docker services (docker compose -f ${COMPOSE_FILE#$REPO_ROOT/} up -d --build --remove-orphans)..."
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

log "Waiting for EmulatorJS, backend, and frontend health checks..."
wait_for_http_health "emulatorjs" "http://localhost:${EMULATORJS_PORT}/healthz"
wait_for_http_health "backend" "http://localhost:${BACKEND_PORT}/health"
wait_for_http_health "frontend" "http://localhost:${FRONTEND_PORT}/health" "http://localhost:${FRONTEND_PORT}"

log "Deployment finished successfully."
