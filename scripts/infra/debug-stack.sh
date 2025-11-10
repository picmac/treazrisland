#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: debug-stack.sh [options]

Collects container status, health information, and recent logs for the local
Docker Compose stack.

Options:
  -s, --service NAME   Limit output to a specific service (can be repeated).
  -t, --tail LINES     Tail this many log lines per service (default: 100).
  -h, --help           Show this help message.

Environment overrides:
  STACK_FILE                Path to the docker-compose file (default: infra/docker-compose.yml).
  TREAZ_COMPOSE_PROJECT_NAME  Compose project name (default: treazrisland).
  TREAZ_ENV_FILE            Path to the shared environment file (default: ./.env).
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if REPO_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null)"; then
  REPO_ROOT="${REPO_ROOT%/}"
else
  REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi
DEFAULT_STACK_FILE="${REPO_ROOT}/infra/docker-compose.yml"
STACK_FILE="${STACK_FILE:-${DEFAULT_STACK_FILE}}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
ENV_FILE="${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}"
ENV_FILE_ORIGINAL="${ENV_FILE}"
TAIL_LINES=100
SERVICES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--service)
      if [[ $# -lt 2 ]]; then
        echo "[debug-stack] --service requires a service name" >&2
        exit 1
      fi
      SERVICES+=("$2")
      shift 2
      ;;
    -t|--tail)
      if [[ $# -lt 2 ]]; then
        echo "[debug-stack] --tail requires a line count" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "[debug-stack] --tail expects an integer but received '$2'" >&2
        exit 1
      fi
      TAIL_LINES="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[debug-stack] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${STACK_FILE}" ]]; then
  echo "[debug-stack] Unable to find compose file: ${STACK_FILE}" >&2
  exit 1
fi

ENV_FILE_IS_TEMP="false"
TEMP_ENV_FILE=""
if [[ ! -f "${ENV_FILE}" ]]; then
  FALLBACK_ENV_FILE="${REPO_ROOT}/.env.example"
  if [[ -f "${FALLBACK_ENV_FILE}" ]]; then
    if TEMP_ENV_FILE=$(mktemp 2>/dev/null); then
      cp "${FALLBACK_ENV_FILE}" "${TEMP_ENV_FILE}"
      ENV_FILE="${TEMP_ENV_FILE}"
      ENV_FILE_IS_TEMP="true"
      cat <<MSG >&2
[debug-stack] Environment file not found at ${ENV_FILE_ORIGINAL:-${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}}.
[debug-stack] Using temporary copy of ${FALLBACK_ENV_FILE} instead.
MSG
    else
      ENV_FILE="${FALLBACK_ENV_FILE}"
      cat <<MSG >&2
[debug-stack] Environment file not found at ${ENV_FILE_ORIGINAL:-${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}}.
[debug-stack] Falling back to ${FALLBACK_ENV_FILE} (unable to create temporary copy).
MSG
    fi
  else
    cat <<MSG >&2
[debug-stack] Environment file not found at ${ENV_FILE_ORIGINAL:-${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}}.
[debug-stack] Proceeding without an env file; docker compose commands may fail if services rely on it.
MSG
  fi
fi

if [[ -n "${ENV_FILE}" && -f "${ENV_FILE}" ]]; then
  export TREAZ_ENV_FILE="${ENV_FILE}"
fi

if [[ "${ENV_FILE_IS_TEMP}" == "true" && -n "${TEMP_ENV_FILE}" ]]; then
  cleanup_temp_env() {
    rm -f "${TEMP_ENV_FILE}"
  }
  trap cleanup_temp_env EXIT
fi

echo "[debug-stack] Compose project: ${PROJECT_NAME}"
echo "[debug-stack] Stack file: ${STACK_FILE}"
echo "[debug-stack] Environment file: ${ENV_FILE}"

if ! docker compose --project-name "${PROJECT_NAME}" --file "${STACK_FILE}" ps --all; then
  echo "[debug-stack] docker compose ps --all failed; falling back to running services" >&2
  if ! docker compose --project-name "${PROJECT_NAME}" --file "${STACK_FILE}" ps; then
    echo "[debug-stack] docker compose ps failed" >&2
  fi
fi

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  if ! mapfile -t SERVICES < <(docker compose --project-name "${PROJECT_NAME}" --file "${STACK_FILE}" config --services); then
    echo "[debug-stack] Unable to enumerate services via docker compose config --services" >&2
    exit 1
  fi
fi

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "[debug-stack] No services defined in ${STACK_FILE}" >&2
  exit 1
fi

for SERVICE in "${SERVICES[@]}"; do
  echo
  echo "[debug-stack] === ${SERVICE} ==="
  CONTAINER_ID=$(docker compose --project-name "${PROJECT_NAME}" --file "${STACK_FILE}" ps -q "${SERVICE}" || true)
  if [[ -z "${CONTAINER_ID}" ]]; then
    echo "[debug-stack] Service '${SERVICE}' is not running (no container ID)."
    continue
  fi

  if ! docker inspect --format='Name: {{.Name}}
Status: {{.State.Status}}
Health: {{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}
Restarts: {{.RestartCount}}
StartedAt: {{.State.StartedAt}}
FinishedAt: {{.State.FinishedAt}}' "${CONTAINER_ID}"; then
    echo "[debug-stack] Unable to inspect container ${CONTAINER_ID}" >&2
  fi

  echo "[debug-stack] Recent logs (tail ${TAIL_LINES} lines):"
  if ! docker compose --project-name "${PROJECT_NAME}" --file "${STACK_FILE}" logs --no-color --tail "${TAIL_LINES}" "${SERVICE}"; then
    echo "[debug-stack] Unable to read logs for service ${SERVICE}" >&2
  fi
done
