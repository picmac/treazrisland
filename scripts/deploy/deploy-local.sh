#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infra/docker-compose.prod.yml}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
ENV_FILE="${TREAZ_ENV_FILE:-/opt/treazrisland/config/compose.env}"
SEED_PLATFORMS="${TREAZ_RUN_PLATFORM_SEED:-false}"
RESET_ON_FAILURE="${TREAZ_RESET_ON_FAILURE:-true}"
HEALTH_MAX_ATTEMPTS="${TREAZ_HEALTH_MAX_ATTEMPTS:-12}"
HEALTH_BACKOFF_SECONDS="${TREAZ_HEALTH_BACKOFF_SECONDS:-5}"
SYNC_WITH_ORIGIN="${TREAZ_SYNC_WITH_ORIGIN:-false}"
DOCKER_CONFIG_DIR="${TREAZ_DOCKER_CONFIG:-${REPO_ROOT}/.docker}"
TEMP_HTTP_ENV_FILE=""

HEALTHCHECK_ORDER=(
  postgres
  minio
  backend
  frontend
)

PROBE_FAILURES=()

cleanup_temp_env_file() {
  if [[ -n "${TEMP_HTTP_ENV_FILE}" && -f "${TEMP_HTTP_ENV_FILE}" ]]; then
    rm -f "${TEMP_HTTP_ENV_FILE}" || true
  fi
}

trap cleanup_temp_env_file EXIT

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

ensure_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    if [[ -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" && -n "${POSTGRES_DB:-}" ]]; then
      export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
      log "DATABASE_URL not provided; defaulting to postgres service host"
      return 0
    else
      log "DATABASE_URL not provided and could not be inferred; set it explicitly or provide Postgres credentials"
      return 1
    fi
  fi

  local normalized="${DATABASE_URL}"
  local rewrote=false

  if [[ "${normalized}" == *"@localhost:"* ]]; then
    normalized="${normalized//@localhost:/@postgres:}"
    rewrote=true
  fi

  if [[ "${normalized}" == *"@127.0.0.1:"* ]]; then
    normalized="${normalized//@127.0.0.1:/@postgres:}"
    rewrote=true
  fi

  if [[ "${rewrote}" == "true" ]]; then
    export DATABASE_URL="${normalized}"
    log "DATABASE_URL pointed at localhost; rewriting to docker postgres service host"
  fi

  return 0
}

sync_database_url_env_files() {
  local value="$1"
  local python_cmd="python3"
  local file="${ENV_FILE}"

  if [[ -z "${value}" ]]; then
    return 0
  fi

  if [[ -z "${file}" || ! -f "${file}" ]]; then
    return 0
  fi

  if ! command -v "${python_cmd}" >/dev/null 2>&1; then
    if command -v python >/dev/null 2>&1; then
      python_cmd="python"
    else
      log "Python interpreter not found; skipping DATABASE_URL env file synchronisation"
      return 0
    fi
  fi

  if [[ ! -w "${file}" ]]; then
    log "Cannot update DATABASE_URL in ${file}; file is not writable"
    return 0
  fi

  local update_result
  if ! update_result=$("${python_cmd}" - "${file}" "${value}" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
value = sys.argv[2]
key = "DATABASE_URL"

try:
    original = path.read_text(encoding="utf-8")
except FileNotFoundError:
    original = ""

lines = original.splitlines()
new_lines = []
found = False
changed = False

desired = f'{key}="{value}"'

for raw_line in lines:
    stripped = raw_line.strip()
    if not stripped or stripped.startswith("#") or "=" not in raw_line:
        new_lines.append(raw_line.rstrip("\n"))
        continue

    key_part, value_part = raw_line.split("=", 1)
    current_key = key_part.strip()

    if current_key == key:
        found = True
        if stripped != desired:
            new_lines.append(desired)
            changed = True
        else:
            new_lines.append(raw_line.rstrip("\n"))
        continue

    new_lines.append(raw_line.rstrip("\n"))

if not found:
    new_lines.append(desired)
    changed = True

if changed:
    Path(path).write_text("\n".join(new_lines) + "\n", encoding="utf-8")

print("changed" if changed else "unchanged")
PY
); then
    log "Failed to update DATABASE_URL in ${file}"
    return 0
  fi

  if [[ "${update_result}" == "changed" ]]; then
    log "Updated DATABASE_URL in ${file} to use postgres service host"
  fi
}

log() {
  local message="$1"
  if command -v logger >/dev/null 2>&1; then
    logger "TREAZRISLAND deploy: ${message}" || true
  fi
  printf '[deploy] %s\n' "${message}"
}

detect_lan_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
  elif command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

format_host_for_url() {
  local host="$1"
  if [[ "${host}" == *:* && "${host}" != "["* ]]; then
    printf '[%s]' "${host}"
  else
    printf '%s' "${host}"
  fi
}

upsert_env_value() {
  local file_path="$1"
  local key="$2"
  local value="$3"
  local python_cmd="python3"

  if [[ -z "${file_path}" || -z "${key}" ]]; then
    return 1
  fi

  if [[ ! -f "${file_path}" ]]; then
    printf '%s\n' "${key}=${value}" >"${file_path}"
    return 0
  fi

  if ! command -v "${python_cmd}" >/dev/null 2>&1; then
    if command -v python >/dev/null 2>&1; then
      python_cmd="python"
    else
      log "Python interpreter not found; cannot update ${key} in ${file_path}"
      return 1
    fi
  fi

  "${python_cmd}" - "$file_path" "$key" "$value" <<'PY' || return 1
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

try:
    original = path.read_text(encoding="utf-8")
except FileNotFoundError:
    original = ""

lines = original.splitlines()
new_lines = []
found = False

desired = f"{key}={value}"

for raw_line in lines:
    stripped = raw_line.strip()
    if not stripped or stripped.startswith("#") or "=" not in raw_line:
        new_lines.append(raw_line.rstrip("\n"))
        continue

    current_key, _ = raw_line.split("=", 1)
    if current_key.strip() == key:
        if stripped != desired:
            new_lines.append(desired)
        else:
            new_lines.append(raw_line.rstrip("\n"))
        found = True
        continue

    new_lines.append(raw_line.rstrip("\n"))

if not found:
    new_lines.append(desired)

Path(path).write_text("\n".join(new_lines) + "\n", encoding="utf-8")
PY
}

should_autoconfig_http_stack() {
  local tls_mode="$(to_lower "${TREAZ_TLS_MODE:-https}")"
  local autoconfig="$(to_lower "${TREAZ_DEV_HTTP_AUTOCONFIG:-true}")"

  [[ "${tls_mode}" == "http" && "${autoconfig}" == "true" ]]
}

apply_http_overrides() {
  if ! should_autoconfig_http_stack; then
    return
  fi

  local preferred_host="${TREAZ_DEV_LAN_HOST:-}";
  local detected_host=""

  if [[ -z "${preferred_host}" ]]; then
    detected_host="$(detect_lan_ip)"
  fi

  local lan_host="${preferred_host:-${detected_host}}"

  if [[ -z "${lan_host}" ]]; then
    log "HTTP autoconfig enabled but no LAN host detected; skipping base URL overrides"
    return
  fi

  local backend_port="${PORT:-3001}"
  local frontend_port="${FRONTEND_PORT:-3000}"
  local formatted_host
  formatted_host="$(format_host_for_url "${lan_host}")"

  local new_api_base="http://${formatted_host}:${backend_port}"
  local new_cors_origin="http://${formatted_host}:${frontend_port}"
  local new_media_cdn="http://${formatted_host}:9000/treaz-assets"

  local updated_keys=()

  if [[ -z "${NEXT_PUBLIC_API_BASE_URL:-}" || "${NEXT_PUBLIC_API_BASE_URL}" == "http://localhost:${backend_port}" || "${NEXT_PUBLIC_API_BASE_URL}" == "http://127.0.0.1:${backend_port}" ]]; then
    NEXT_PUBLIC_API_BASE_URL="${new_api_base}"
    export NEXT_PUBLIC_API_BASE_URL
    updated_keys+=("NEXT_PUBLIC_API_BASE_URL")
    log "Setting NEXT_PUBLIC_API_BASE_URL to ${NEXT_PUBLIC_API_BASE_URL} for LAN access"
  fi

  if [[ -z "${CORS_ALLOWED_ORIGINS:-}" || "${CORS_ALLOWED_ORIGINS}" == "http://localhost:${frontend_port}" || "${CORS_ALLOWED_ORIGINS}" == "http://127.0.0.1:${frontend_port}" ]]; then
    CORS_ALLOWED_ORIGINS="${new_cors_origin}"
    export CORS_ALLOWED_ORIGINS
    updated_keys+=("CORS_ALLOWED_ORIGINS")
    log "Setting CORS_ALLOWED_ORIGINS to ${CORS_ALLOWED_ORIGINS} for LAN access"
  fi

  if [[ -z "${NEXT_PUBLIC_MEDIA_CDN:-}" || "${NEXT_PUBLIC_MEDIA_CDN}" == "http://localhost:9000/treaz-assets" || "${NEXT_PUBLIC_MEDIA_CDN}" == "http://127.0.0.1:9000/treaz-assets" ]]; then
    NEXT_PUBLIC_MEDIA_CDN="${new_media_cdn}"
    export NEXT_PUBLIC_MEDIA_CDN
    updated_keys+=("NEXT_PUBLIC_MEDIA_CDN")
    log "Setting NEXT_PUBLIC_MEDIA_CDN to ${NEXT_PUBLIC_MEDIA_CDN} for LAN access"
  fi

  if (( ${#updated_keys[@]} == 0 )); then
    log "HTTP autoconfig detected custom overrides; leaving existing values in place"
    return
  fi

  local normalized_tls="$(to_lower "${TREAZ_TLS_MODE:-https}")"
  if [[ "${normalized_tls}" != "http" ]]; then
    TREAZ_TLS_MODE=http
    export TREAZ_TLS_MODE
    updated_keys+=("TREAZ_TLS_MODE")
    log "Setting TREAZ_TLS_MODE to http so browsers do not force HTTPS during LAN testing"
  fi

  if [[ ! -f "${ENV_FILE}" ]]; then
    log "Environment file ${ENV_FILE} missing; skipping HTTP override persistence"
    return
  fi

  local temp_file
  if ! temp_file="$(mktemp)"; then
    log "Failed to create temporary file for HTTP overrides"
    return
  fi

  TEMP_HTTP_ENV_FILE="${temp_file}"
  if ! cp "${ENV_FILE}" "${TEMP_HTTP_ENV_FILE}"; then
    log "Failed to copy ${ENV_FILE} for HTTP overrides"
    return
  fi

  local key
  for key in "${updated_keys[@]}"; do
    local value="${!key}"
    if ! upsert_env_value "${TEMP_HTTP_ENV_FILE}" "${key}" "${value}"; then
      log "Unable to persist ${key} override"
    fi
  done

  ENV_FILE="${TEMP_HTTP_ENV_FILE}"
  log "Wrote HTTP overrides to ${ENV_FILE} so LAN clients can reach the stack"
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
require_file "${ENV_FILE}" "environment file"

if [[ -f "${ENV_FILE}" ]]; then
  log "Loading environment exports from ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  log "No environment file found at ${ENV_FILE}; relying on host environment"
fi

if ! ensure_database_url; then
  log "Unable to determine DATABASE_URL; aborting deployment"
  exit 1
fi

sync_database_url_env_files "${DATABASE_URL}"

apply_http_overrides

export TREAZ_ENV_FILE="${ENV_FILE}"
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
