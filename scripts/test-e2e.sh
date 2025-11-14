#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infrastructure/compose/docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-treazrisland-e2e}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
DEFAULT_FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
DEFAULT_BACKEND_URL="http://localhost:${BACKEND_PORT}"
ARTIFACT_DIR="$ROOT_DIR/tests/playwright/artifacts"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-$DEFAULT_FRONTEND_URL}"
PLAYWRIGHT_API_URL="${PLAYWRIGHT_API_URL:-$DEFAULT_BACKEND_URL}"
KEEP_STACK="${KEEP_E2E_STACK:-0}"
WAIT_ATTEMPTS="${E2E_WAIT_ATTEMPTS:-120}"
WAIT_DELAY_SECONDS="${E2E_WAIT_DELAY_SECONDS:-3}"

log() {
  echo "[test:e2e] $*"
}

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI is required to run test:e2e"
  exit 1
fi

compose() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  log "Collecting Docker Compose logs"
  compose logs --no-color \
    > "$ARTIFACT_DIR/compose.log" 2>&1 || true

  if [[ "$KEEP_STACK" != "1" ]]; then
    log "Stopping Docker Compose stack"
    compose down -v || true
  else
    log "KEEP_E2E_STACK=1 detected — leaving containers running"
  fi
}

trap cleanup EXIT

cd "$ROOT_DIR"

log "Booting Docker Compose stack ($COMPOSE_FILE)"
compose up -d --build

wait_for_url() {
  local url="$1"
  local label="$2"
  local service_name="${3:-}"
  local attempts="${4:-$WAIT_ATTEMPTS}"
  local delay="${5:-$WAIT_DELAY_SECONDS}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$label is ready ($url)"
      return 0
    fi

    if (( i % 5 == 0 )); then
      log "$label not ready yet (attempt $i/$attempts)"
      if [[ -n "$service_name" ]]; then
        compose ps "$service_name" || true
        compose logs --tail 20 "$service_name" || true
      fi
    fi

    sleep "$delay"
  done

  log "Timed out waiting for $label at $url" >&2
  if [[ -n "$service_name" ]]; then
    log "--- $service_name logs (last 200 lines) ---"
    compose logs --tail 200 "$service_name" || true
    log "--- End of $service_name logs ---"
  fi
  exit 1
}

wait_for_url "http://localhost:${BACKEND_PORT}/health" "backend" "backend"
wait_for_url "http://localhost:${FRONTEND_PORT}" "frontend" "frontend"

log "Running Playwright suite"
PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
PLAYWRIGHT_API_URL="$PLAYWRIGHT_API_URL" \
pnpm --filter @treazrisland/playwright test:e2e
