#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infra/docker-compose.prod.yml}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
ENV_FILE="${TREAZ_ENV_FILE:-/opt/treazrisland/config/compose.env}"
SEED_PLATFORMS="${TREAZ_RUN_PLATFORM_SEED:-false}"
RESET_ON_FAILURE="${TREAZ_RESET_ON_FAILURE:-false}"
HEALTH_MAX_ATTEMPTS="${TREAZ_HEALTH_MAX_ATTEMPTS:-12}"
HEALTH_BACKOFF_SECONDS="${TREAZ_HEALTH_BACKOFF_SECONDS:-5}"
SYNC_WITH_ORIGIN="${TREAZ_SYNC_WITH_ORIGIN:-false}"
DOCKER_CONFIG_DIR="${TREAZ_DOCKER_CONFIG:-${REPO_ROOT}/.docker}"
DEPLOY_DEBUG="${TREAZ_DEPLOY_DEBUG:-true}"
COMPOSE_PROGRESS_MODE="${TREAZ_COMPOSE_PROGRESS:-plain}"
LOG_DIR="${TREAZ_DEPLOY_LOG_DIR:-${REPO_ROOT}/diagnostics}"

ENV_FILE_TEMPLATE="${TREAZ_ENV_TEMPLATE:-${REPO_ROOT}/.env.example}"
ENV_FILE_ORIGINAL="${ENV_FILE}"
ENV_FILE_IS_EPHEMERAL="false"
ENV_FILE_TEMPLATE_SOURCE=""

if [[ "${COMPOSE_PROGRESS_MODE}" != "auto" && "${COMPOSE_PROGRESS_MODE}" != "plain" ]]; then
  COMPOSE_PROGRESS_MODE="plain"
fi

HEALTHCHECK_ORDER=(
  postgres
  minio
  backend
  frontend
)

PROBE_FAILURES=()

collect_probe_failure_logs() {
  if (( ${#PROBE_FAILURES[@]} == 0 )); then
    return
  fi

  log "Collecting logs for failing services"
  local service
  for service in "${PROBE_FAILURES[@]}"; do
    log "Last 100 log lines for ${service}"
    if ! docker compose -f "${COMPOSE_FILE}" logs --tail 100 "${service}" 2>&1 \
      | sed "s/^/[${service}] /"; then
      log "Failed to collect logs for ${service}"
    fi
  done
}

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
  local args=(up -d --remove-orphans)
  compose_invoke "${args[@]}"
}

reset_stack() {
  log "Health checks failed; resetting stack (containers and volumes will be recreated)"
  compose_invoke down -v
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
      local encoded_user
      local encoded_password
      local encoded_db

      if ! encoded_user=$(percent_encode "${POSTGRES_USER}"); then
        return 1
      fi

      if ! encoded_password=$(percent_encode "${POSTGRES_PASSWORD}"); then
        return 1
      fi

      if ! encoded_db=$(percent_encode "${POSTGRES_DB}"); then
        return 1
      fi

      export DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@postgres:5432/${encoded_db}?schema=public"
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

sync_env_value() {
  local key="$1"
  local value="$2"
  local python_cmd
  local file="${ENV_FILE}"

  if [[ -z "${key}" || -z "${value}" ]]; then
    return 0
  fi

  if [[ -z "${file}" || ! -f "${file}" ]]; then
    return 0
  fi

  if ! python_cmd=$(select_python_interpreter); then
    log "Python interpreter not found; skipping ${key} env file synchronisation"
    return 0
  fi

  if [[ ! -w "${file}" ]]; then
    log "Cannot update ${key} in ${file}; file is not writable"
    return 0
  fi

  local update_result
  if ! update_result=$("${python_cmd}" - "${file}" "${key}" "${value}" <<'PY'
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
    log "Failed to update ${key} in ${file}"
    return 0
  fi

  if [[ "${update_result}" == "changed" ]]; then
    log "Updated ${key} in ${file}"
  fi
}

ensure_storage_endpoint() {
  if [[ "${STORAGE_DRIVER:-}" != "s3" ]]; then
    return 0
  fi

  local endpoint="${STORAGE_ENDPOINT:-}"
  local regex='^(https?://)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:[0-9]+)?(.*)$'

  if [[ -z "${endpoint}" ]]; then
    endpoint="http://minio:9000"
    export STORAGE_ENDPOINT="${endpoint}"
    log "STORAGE_ENDPOINT not provided; defaulting to MinIO service host"
    sync_env_value "STORAGE_ENDPOINT" "${endpoint}"
    return 0
  fi

  if [[ "${endpoint}" =~ ${regex} ]]; then
    local suffix="${BASH_REMATCH[4]}"
    endpoint="http://minio:9000${suffix}"
    export STORAGE_ENDPOINT="${endpoint}"
    log "STORAGE_ENDPOINT pointed at localhost; rewriting to MinIO service host"
    sync_env_value "STORAGE_ENDPOINT" "${endpoint}"
  fi
}

log() {
  local message="$1"
  if command -v logger >/dev/null 2>&1; then
    logger "TREAZRISLAND deploy: ${message}" || true
  fi
  printf '[deploy] %s\n' "${message}"
}

select_python_interpreter() {
  if command -v python3 >/dev/null 2>&1; then
    printf 'python3'
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    printf 'python'
    return 0
  fi

  return 1
}

percent_encode() {
  local value="$1"
  local python_cmd

  if ! python_cmd=$(select_python_interpreter); then
    printf '%s' "${value}"
    return 0
  fi

  "${python_cmd}" - "$value" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
}

compose_invoke() {
  local subcommand="$1"
  shift || true
  local docker_args=()
  local args=(compose -f "${COMPOSE_FILE}")

  if [[ "$(to_lower "${DEPLOY_DEBUG}")" == "true" ]]; then
    docker_args+=(--log-level debug)
  fi

  if [[ "${subcommand}" == "build" ]]; then
    args+=("--progress=${COMPOSE_PROGRESS_MODE}")
  fi

  args+=("${subcommand}")
  if [[ $# -gt 0 ]]; then
    args+=("$@")
  fi

  docker "${docker_args[@]}" "${args[@]}"
}

resolve_env_file() {
  local requested_path="$1"
  local template_path="$2"

  ENV_FILE_IS_EPHEMERAL="false"
  ENV_FILE_TEMPLATE_SOURCE=""

  if [[ -f "${requested_path}" ]]; then
    printf '%s' "${requested_path}"
    return 0
  fi

  if [[ -n "${template_path}" && -f "${template_path}" ]]; then
    local temp_file
    if ! temp_file=$(mktemp "${TMPDIR:-/tmp}/treaz-env.XXXXXX"); then
      printf 'Missing environment file at %s and failed to create a temporary copy from %s\n' \
        "${requested_path}" "${template_path}" >&2
      return 1
    fi

    if ! cp "${template_path}" "${temp_file}"; then
      rm -f "${temp_file}" || true
      printf 'Missing environment file at %s and failed to copy template %s\n' \
        "${requested_path}" "${template_path}" >&2
      return 1
    fi

    ENV_FILE_IS_EPHEMERAL="true"
    ENV_FILE_TEMPLATE_SOURCE="${template_path}"
    printf '%s' "${temp_file}"
    return 0
  fi

  printf 'Missing environment file at %s\n' "${requested_path}" >&2
  if [[ -n "${template_path}" ]]; then
    printf 'Template file %s was also unavailable\n' "${template_path}" >&2
  fi
  return 1
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
if ! resolved_env_file=$(resolve_env_file "${ENV_FILE}" "${ENV_FILE_TEMPLATE}"); then
  exit 1
fi

if [[ "${ENV_FILE_IS_EPHEMERAL}" == "true" ]]; then
  log "Environment file ${ENV_FILE_ORIGINAL} not found; using temporary copy of ${ENV_FILE_TEMPLATE_SOURCE} at ${resolved_env_file}"
fi

ENV_FILE="${resolved_env_file}"
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

sync_env_value "DATABASE_URL" "${DATABASE_URL}"

ensure_storage_endpoint

export TREAZ_ENV_FILE="${ENV_FILE}"
export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

cd "${REPO_ROOT}"

mkdir -p "${LOG_DIR}"
log "Writing deployment diagnostics to ${LOG_DIR}"

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

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-1}"

log "Building production images"
if ! compose_invoke build --pull 2>&1 | tee "${LOG_DIR}/compose-build.log"; then
  log "docker compose build failed. Review ${LOG_DIR}/compose-build.log for details"
  exit 1
fi

log "Applying stack changes"
bring_up_stack

log "Verifying service health"
if ! run_all_probes; then
  collect_probe_failure_logs
  if [[ "$(to_lower "${RESET_ON_FAILURE}")" == "true" ]]; then
    reset_stack
    log "Re-running service health checks after reset"
    if ! run_all_probes; then
      collect_probe_failure_logs
      log "Health checks failed after stack reset for: ${PROBE_FAILURES[*]}"
      log "Skipping migrations because required services are unhealthy"
      exit 1
    fi
  else
    log "Health checks failed; TREAZ_RESET_ON_FAILURE is disabled so the stack will be left as-is for investigation"
    log "Set TREAZ_RESET_ON_FAILURE=true to restore the previous behaviour of tearing down and retrying"
    exit 1
  fi
fi

log "Running database migrations with Prisma debug output"
if ! docker compose -f "${COMPOSE_FILE}" exec backend env PRISMA_LOG_LEVEL=debug DEBUG="prisma:*" npx prisma migrate deploy 2>&1 \
  | tee "${LOG_DIR}/prisma-migrate.log"; then
  log "Prisma migrate failed. Review ${LOG_DIR}/prisma-migrate.log for details"
  exit 1
fi

if [[ "${SEED_PLATFORMS}" == "true" ]]; then
  log "Seeding reference platform data"
  if ! docker compose -f "${COMPOSE_FILE}" exec backend env PRISMA_LOG_LEVEL=debug DEBUG="prisma:*" npm run prisma:seed:platforms 2>&1 \
    | tee "${LOG_DIR}/prisma-seed.log"; then
    log "Prisma platform seed failed. Review ${LOG_DIR}/prisma-seed.log for details"
    exit 1
  fi
fi

log "Deployment completed"
