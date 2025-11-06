#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infra/docker-compose.prod.yml}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
BACKEND_ENV_FILE="${TREAZ_BACKEND_ENV_FILE:-/opt/treazrisland/config/backend.env}"
FRONTEND_ENV_FILE="${TREAZ_FRONTEND_ENV_FILE:-/opt/treazrisland/config/frontend.env}"
COMPOSE_ENV_FILE="${TREAZ_COMPOSE_ENV_FILE:-/opt/treazrisland/config/compose.env}"
SEED_PLATFORMS="${TREAZ_RUN_PLATFORM_SEED:-false}"

log() {
  local message="$1"
  if command -v logger >/dev/null 2>&1; then
    logger "TREAZRISLAND deploy: ${message}"
  fi
  printf '[deploy] %s\n' "${message}"
}

require_file() {
  local path="$1"
  local description="$2"
  if [[ ! -f "${path}" ]]; then
    printf 'Missing %s at %s\n' "${description}" "${path}" >&2
    exit 1
  fi
}

log "Preparing environment"
require_file "${BACKEND_ENV_FILE}" "backend env file"
require_file "${FRONTEND_ENV_FILE}" "frontend env file"

if [[ -f "${COMPOSE_ENV_FILE}" ]]; then
  log "Loading compose environment overrides from ${COMPOSE_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${COMPOSE_ENV_FILE}"
  set +a
else
  log "No compose environment file found at ${COMPOSE_ENV_FILE}; relying on host environment"
fi

export TREAZ_BACKEND_ENV_FILE="${BACKEND_ENV_FILE}"
export TREAZ_FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE}"
export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

cd "${REPO_ROOT}"

log "Synchronising repository state with origin/main"
git fetch --prune
git checkout main
git reset --hard origin/main

log "Building production images"
docker compose -f "${COMPOSE_FILE}" build --pull

log "Applying stack changes"
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

log "Running database migrations"
docker compose -f "${COMPOSE_FILE}" exec backend npx prisma migrate deploy

if [[ "${SEED_PLATFORMS}" == "true" ]]; then
  log "Seeding reference platform data"
  docker compose -f "${COMPOSE_FILE}" exec backend npm run prisma:seed:platforms
fi

log "Deployment completed"
