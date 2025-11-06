#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infra/docker-compose.prod.yml}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
CENTRAL_ENV_FILE="${TREAZ_ENV_FILE:-/opt/treazrisland/config/compose.env}"
COMPOSE_ENV_FILE="${TREAZ_COMPOSE_ENV_FILE:-${CENTRAL_ENV_FILE}}"
BACKEND_ENV_FILE="${TREAZ_BACKEND_ENV_FILE:-${CENTRAL_ENV_FILE}}"
FRONTEND_ENV_FILE="${TREAZ_FRONTEND_ENV_FILE:-${CENTRAL_ENV_FILE}}"
SEED_PLATFORMS="${TREAZ_RUN_PLATFORM_SEED:-false}"
RESET_ON_FAILURE="${TREAZ_RESET_ON_FAILURE:-true}"
HEALTH_MAX_ATTEMPTS="${TREAZ_HEALTH_MAX_ATTEMPTS:-12}"
HEALTH_BACKOFF_SECONDS="${TREAZ_HEALTH_BACKOFF_SECONDS:-5}"
SYNC_WITH_ORIGIN="${TREAZ_SYNC_WITH_ORIGIN:-false}"
DOCKER_CONFIG_DIR="${TREAZ_DOCKER_CONFIG:-${REPO_ROOT}/.docker}"

HEALTHCHECK_ORDER=(
  postgres
  minio
  backend
  frontend
)

PROBE_FAILURES=()

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Docker CLI not found. Install Docker or set TREAZ_USE_HOST_RUNTIME to run without containers (not yet implemented)."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    log "Docker daemon is not reachable (is it running, and do you have permission to access /var/run/docker.sock?)"
    exit 1
  fi
}

bring_up_stack() {
  docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
}

reset_stack() {
  log "Health checks failed; resetting stack (containers and volumes will be recreated)"
  docker compose -f "${COMPOSE_FILE}" down -v
  log "Recreating services after reset"
  bring_up_stack
}

resolve_service_port() {
  local service="$1"
  local container_port="$2"
  local port_output

  if ! port_output=$(docker compose -f "${COMPOSE_FILE}" port "${service}" "${container_port}" 2>/dev/null | head -n1); then
    return 1
  fi

  if [[ -z "${port_output}" ]]; then
    return 1
  fi

  printf '%s' "${port_output##*:}"
}

resolve_service_http_url() {
  local service="$1"
  local container_port="$2"
  local path="$3"
  local port

  if ! port=$(resolve_service_port "${service}" "${container_port}"); then
    return 1
  fi

  printf 'http://127.0.0.1:%s%s' "${port}" "${path}"
}

get_healthcheck_command() {
  local service="$1"
  local command

  case "${service}" in
    postgres)
      printf -v command 'docker compose -f %q exec -T postgres pg_isready -U %q' "${COMPOSE_FILE}" "${POSTGRES_USER:-treazrisland}"
      ;;
    minio)
      local minio_url
      if ! minio_url=$(resolve_service_http_url "minio" 9000 "/minio/health/ready"); then
        return 1
      fi
      printf -v command 'curl -fsS %q >/dev/null' "${minio_url}"
      ;;
    backend)
      local backend_url
      if ! backend_url=$(resolve_service_http_url "backend" 3001 "/health"); then
        return 1
      fi
      printf -v command 'curl -fsS %q >/dev/null' "${backend_url}"
      ;;
    frontend)
      local frontend_url
      if ! frontend_url=$(resolve_service_http_url "frontend" 3000 "/"); then
        return 1
      fi
      printf -v command 'curl -fsS %q >/dev/null' "${frontend_url}"
      ;;
    *)
      return 1
      ;;
  esac

  printf '%s' "${command}"
}

to_lower() {
  local value="$1"
  printf '%s' "${value,,}"
}

reset_probe_failures() {
  PROBE_FAILURES=()
}

run_probe() {
  local service_name="$1"
  local attempt=1
  local attempts="${HEALTH_MAX_ATTEMPTS}"
  local backoff="${HEALTH_BACKOFF_SECONDS}"

  while (( attempt <= attempts )); do
    local command
    local had_command=true

    if ! command=$(get_healthcheck_command "${service_name}"); then
      had_command=false
    fi

    if [[ "${had_command}" == "true" ]]; then
      if eval "${command}"; then
        log "Health check for ${service_name} succeeded on attempt ${attempt}/${attempts}"
        return 0
      fi
      log "Health check for ${service_name} failed (attempt ${attempt}/${attempts})"
    else
      log "Failed to construct health check command for ${service_name} (attempt ${attempt}/${attempts})"
    fi

    if (( attempt < attempts )); then
      log "Retrying ${service_name} health check in ${backoff}s"
      if (( backoff > 0 )); then
        sleep "${backoff}"
      fi
    else
      log "Health check for ${service_name} exhausted ${attempts} attempts"
    fi

    ((attempt++))
  done

  return 1
}

run_all_probes() {
  reset_probe_failures
  local service
  for service in "${HEALTHCHECK_ORDER[@]}"; do
    if ! run_probe "${service}"; then
      PROBE_FAILURES+=("${service}")
    fi
  done

  if (( ${#PROBE_FAILURES[@]} > 0 )); then
    log "Health checks failed for: ${PROBE_FAILURES[*]}"
    return 1
  fi

  log "All health checks passed"
  return 0
}

log() {
  local message="$1"
  if command -v logger >/dev/null 2>&1; then
    logger "TREAZRISLAND deploy: ${message}" || true
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
require_file "${CENTRAL_ENV_FILE}" "central environment file"

if [[ "${BACKEND_ENV_FILE}" != "${CENTRAL_ENV_FILE}" ]]; then
  require_file "${BACKEND_ENV_FILE}" "backend env file"
else
  log "Backend env file not provided; using central environment exports"
fi

if [[ "${FRONTEND_ENV_FILE}" != "${CENTRAL_ENV_FILE}" ]]; then
  require_file "${FRONTEND_ENV_FILE}" "frontend env file"
else
  log "Frontend env file not provided; using central environment exports"
fi

if [[ -f "${COMPOSE_ENV_FILE}" ]]; then
  log "Loading environment exports from ${COMPOSE_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${COMPOSE_ENV_FILE}"
  set +a
else
  log "No environment file found at ${COMPOSE_ENV_FILE}; relying on host environment"
fi

export TREAZ_BACKEND_ENV_FILE="${BACKEND_ENV_FILE}"
export TREAZ_FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE}"
export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

cd "${REPO_ROOT}"

if [[ -n "${DOCKER_CONFIG_DIR}" ]]; then
  mkdir -p "${DOCKER_CONFIG_DIR}"
  export DOCKER_CONFIG="${DOCKER_CONFIG_DIR}"
  log "Using docker config directory at ${DOCKER_CONFIG_DIR}"
fi

if [[ "$(to_lower "${SYNC_WITH_ORIGIN}")" == "true" ]]; then
  log "Synchronising repository state with origin/main"
  if ! git fetch --prune; then
    log "Failed to fetch origin/main; continuing with existing checkout"
  else
    current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'HEAD')"
    if git show-ref --verify --quiet refs/heads/main; then
      if ! git checkout main; then
        log "Failed to checkout main; continuing on ${current_branch}"
      fi
    fi
    if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
      if ! git reset --hard origin/main; then
        log "Failed to reset main to origin/main; continuing with local state"
      fi
    else
      log "origin/main not available locally; skipping reset"
    fi
    if [[ "${current_branch}" != "main" ]]; then
      if ! git checkout "${current_branch}" >/dev/null 2>&1; then
        log "Warning: failed to restore branch ${current_branch}; remaining on $(git rev-parse --abbrev-ref HEAD)"
      fi
    fi
  fi
else
  log "Skipping repository synchronisation; using current checkout (set TREAZ_SYNC_WITH_ORIGIN=true to enable)"
fi

require_docker

log "Building production images"
docker compose -f "${COMPOSE_FILE}" build --pull

log "Applying stack changes"
bring_up_stack

log "Verifying service health"
if ! run_all_probes; then
  if [[ "$(to_lower "${RESET_ON_FAILURE}")" == "true" ]]; then
    reset_stack
    log "Re-running service health checks after reset"
    if ! run_all_probes; then
      log "Health checks failed after stack reset for: ${PROBE_FAILURES[*]}"
      log "Skipping migrations because required services are unhealthy"
      exit 1
    fi
  else
    log "Health checks failed and TREAZ_RESET_ON_FAILURE is disabled; skipping migrations"
    exit 1
  fi
fi

log "Running database migrations"
docker compose -f "${COMPOSE_FILE}" exec backend npx prisma migrate deploy

if [[ "${SEED_PLATFORMS}" == "true" ]]; then
  log "Seeding reference platform data"
  docker compose -f "${COMPOSE_FILE}" exec backend npm run prisma:seed:platforms
fi

log "Deployment completed"
