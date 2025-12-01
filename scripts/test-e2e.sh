#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infrastructure/compose/docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-treazrisland-e2e}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
POSTGRES_PORT="${POSTGRES_PORT:-55432}"
REDIS_PORT="${REDIS_PORT:-6380}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
EMULATORJS_PORT="${EMULATORJS_PORT:-8080}"
PLAYWRIGHT_STORAGE_HOST_OVERRIDE="${PLAYWRIGHT_STORAGE_HOST_OVERRIDE:-localhost:${MINIO_PORT}}"
COMPOSE_PROFILES="${COMPOSE_PROFILES:-emulatorjs}"
DEFAULT_FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
DEFAULT_BACKEND_URL="http://localhost:${BACKEND_PORT}"
ARTIFACT_DIR="$ROOT_DIR/tests/playwright/artifacts"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-$DEFAULT_FRONTEND_URL}"
PLAYWRIGHT_API_URL="${PLAYWRIGHT_API_URL:-$DEFAULT_BACKEND_URL}"
PLAYWRIGHT_REDIS_URL="${PLAYWRIGHT_REDIS_URL:-redis://localhost:${REDIS_PORT:-6379}/0}"
SKIP_PLAYWRIGHT_INSTALL="${SKIP_PLAYWRIGHT_INSTALL:-0}"
KEEP_STACK="${KEEP_E2E_STACK:-0}"
WAIT_ATTEMPTS="${E2E_WAIT_ATTEMPTS:-120}"
WAIT_DELAY_SECONDS="${E2E_WAIT_DELAY_SECONDS:-3}"
LOG_STREAM_SERVICES="${E2E_LOG_STREAM_SERVICES:-frontend backend}"
LOG_STREAM_FILE="$ARTIFACT_DIR/stack-stream.log"
LOG_STREAM_PID=""

export \
  BACKEND_PORT \
  COMPOSE_FILE \
  COMPOSE_PROJECT_NAME \
  COMPOSE_PROFILES \
  EMULATORJS_PORT \
  FRONTEND_PORT \
  MINIO_CONSOLE_PORT \
  MINIO_PORT \
  PLAYWRIGHT_API_URL \
  PLAYWRIGHT_BASE_URL \
  PLAYWRIGHT_REDIS_URL \
  PLAYWRIGHT_STORAGE_HOST_OVERRIDE \
  POSTGRES_PORT \
  REDIS_PORT

if [[ -n "$PLAYWRIGHT_STORAGE_HOST_OVERRIDE" ]]; then
  IFS=':' read -r PLAYWRIGHT_STORAGE_HOST PLAYWRIGHT_STORAGE_PORT <<<"$PLAYWRIGHT_STORAGE_HOST_OVERRIDE"

  if [[ -n "$PLAYWRIGHT_STORAGE_HOST" && -z "${OBJECT_STORAGE_PUBLIC_HOST:-}" ]]; then
    OBJECT_STORAGE_PUBLIC_HOST="$PLAYWRIGHT_STORAGE_HOST"
    export OBJECT_STORAGE_PUBLIC_HOST
  fi

  if [[ -n "$PLAYWRIGHT_STORAGE_PORT" && -z "${OBJECT_STORAGE_PUBLIC_PORT:-}" ]]; then
    OBJECT_STORAGE_PUBLIC_PORT="$PLAYWRIGHT_STORAGE_PORT"
    export OBJECT_STORAGE_PUBLIC_PORT
  fi
fi

log() {
  echo "[test:e2e] $*"
}

log_block() {
  local prefix="$1"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    log "[$prefix] $line"
  done
}

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI is required to run test:e2e"
  exit 1
fi

log "Configuration summary:"
log "  COMPOSE_FILE=$COMPOSE_FILE"
log "  COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"
log "  WAIT_ATTEMPTS=$WAIT_ATTEMPTS"
log "  WAIT_DELAY_SECONDS=${WAIT_DELAY_SECONDS}s"
log "  PLAYWRIGHT_BASE_URL=$PLAYWRIGHT_BASE_URL"
log "  PLAYWRIGHT_API_URL=$PLAYWRIGHT_API_URL"
log "  PLAYWRIGHT_REDIS_URL=$PLAYWRIGHT_REDIS_URL"
log "  PLAYWRIGHT_STORAGE_HOST_OVERRIDE=$PLAYWRIGHT_STORAGE_HOST_OVERRIDE"
log "  OBJECT_STORAGE_PUBLIC_HOST=${OBJECT_STORAGE_PUBLIC_HOST:-<unset>}"
log "  OBJECT_STORAGE_PUBLIC_PORT=${OBJECT_STORAGE_PUBLIC_PORT:-<unset>}"
log "  SKIP_PLAYWRIGHT_INSTALL=$SKIP_PLAYWRIGHT_INSTALL"
if [[ -n "${LOG_STREAM_SERVICES// }" ]]; then
  log "  E2E_LOG_STREAM_SERVICES=$LOG_STREAM_SERVICES"
else
  log "  E2E_LOG_STREAM_SERVICES=<disabled>"
fi

docker --version 2>&1 | log_block docker
docker compose version 2>&1 | log_block docker
if docker info >/dev/null 2>&1; then
  docker info --format 'ServerVersion={{.ServerVersion}} Kernel={{.KernelVersion}}' 2>/dev/null \
    | log_block docker
fi
if command -v df >/dev/null 2>&1; then
  df -h . | log_block disk
fi
if command -v free >/dev/null 2>&1; then
  free -m | log_block memory
fi

compose() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

mkdir -p "$ARTIFACT_DIR"

ensure_playwright_browsers() {
  if [[ "$SKIP_PLAYWRIGHT_INSTALL" == "1" ]]; then
    log "Skipping Playwright browser install (SKIP_PLAYWRIGHT_INSTALL=1)"
    return
  fi

  log "Ensuring Playwright browsers are installed"
  pnpm --filter @treazrisland/playwright exec playwright install --with-deps 2>&1 \
    | log_block playwright
}

ensure_playwright_browsers

stop_log_stream() {
  if [[ -n "$LOG_STREAM_PID" ]] && kill -0 "$LOG_STREAM_PID" >/dev/null 2>&1; then
    log "Stopping live log stream (pid $LOG_STREAM_PID)"
    kill "$LOG_STREAM_PID" >/dev/null 2>&1 || true
    wait "$LOG_STREAM_PID" 2>/dev/null || true
    LOG_STREAM_PID=""
  fi
}

cleanup() {
  stop_log_stream
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

dump_stack_state() {
  log '--- docker compose ps ---'
  compose ps | log_block ps || true
  if command -v docker >/dev/null 2>&1; then
    log '--- docker stats (no-stream) ---'
    docker stats --no-stream \
      | log_block stats || true
  fi
  log '--- end of snapshot ---'
}

start_log_stream() {
  local services_raw="$1"
  local trimmed="${services_raw// }"

  if [[ -z "$trimmed" ]]; then
    log "Live log streaming disabled"
    return
  fi

  read -ra services <<< "$services_raw"
  log "Starting live log stream for: ${services[*]} (-> $LOG_STREAM_FILE)"
  (
    set +e
    compose logs --timestamps --no-color --follow "${services[@]}" 2>&1 \
      | tee -a "$LOG_STREAM_FILE" \
      | while IFS= read -r line; do
          log "[stream] $line"
        done
  ) &
  LOG_STREAM_PID=$!
}

dump_stack_state
start_log_stream "$LOG_STREAM_SERVICES"

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
  dump_stack_state
  exit 1
}

wait_for_url "http://localhost:${BACKEND_PORT}/health" "backend" "backend"
wait_for_url "http://localhost:${FRONTEND_PORT}" "frontend" "frontend"

log "Running Playwright suite"
PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
PLAYWRIGHT_API_URL="$PLAYWRIGHT_API_URL" \
PLAYWRIGHT_REDIS_URL="$PLAYWRIGHT_REDIS_URL" \
pnpm --filter @treazrisland/playwright exec playwright test ${PLAYWRIGHT_CLI_ARGS:-}
