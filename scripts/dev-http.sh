#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
FRONTEND_DIR="${REPO_ROOT}/frontend"

HTTP_ENV_CANDIDATE="${TREAZ_HTTP_ENV_FILE:-${REPO_ROOT}/.env.http}"
DEFAULT_ENV_CANDIDATE="${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}"
ENV_FILE=""

if [[ -f "${HTTP_ENV_CANDIDATE}" ]]; then
  ENV_FILE="${HTTP_ENV_CANDIDATE}"
elif [[ -f "${DEFAULT_ENV_CANDIDATE}" ]]; then
  ENV_FILE="${DEFAULT_ENV_CANDIDATE}"
fi

if [[ -z "${ENV_FILE}" ]]; then
  echo "[dev-http] Unable to find a non-TLS env file." >&2
  echo "[dev-http] Create ${HTTP_ENV_CANDIDATE} (or .env) from .env.example before running this helper." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

export TREAZ_TLS_MODE=http

BACKEND_PORT_VALUE="${PORT:-${BACKEND_PORT:-3001}}"
FRONTEND_PORT_VALUE="${FRONTEND_PORT:-3000}"
BACKEND_HOST="${DEV_HTTP_BACKEND_HOST:-localhost}"
FRONTEND_HOST="${DEV_HTTP_FRONTEND_HOST:-localhost}"

if [[ -z "${NEXT_PUBLIC_API_BASE_URL:-}" ]]; then
  export NEXT_PUBLIC_API_BASE_URL="http://${BACKEND_HOST}:${BACKEND_PORT_VALUE}"
fi

if [[ -z "${STORAGE_ENDPOINT:-}" ]]; then
  export STORAGE_ENDPOINT="http://${BACKEND_HOST}:9000"
fi

backend_pid=""
frontend_pid=""

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM

  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  fi

  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
    wait "${frontend_pid}" 2>/dev/null || true
  fi

  exit "${exit_code}"
}

on_interrupt() {
  echo "\n[dev-http] Caught signal, shutting down services..."
  exit 130
}

on_terminate() {
  echo "\n[dev-http] Termination requested, shutting down services..."
  exit 143
}

trap cleanup EXIT
trap on_interrupt INT
trap on_terminate TERM

start_backend() {
  echo "[dev-http] Starting backend on http://${BACKEND_HOST}:${BACKEND_PORT_VALUE} (env: ${ENV_FILE})"
  (
    cd "${BACKEND_DIR}" || exit 1
    PORT="${BACKEND_PORT_VALUE}" npm run dev
  ) &
  backend_pid=$!
}

start_frontend() {
  echo "[dev-http] Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT_VALUE}"
  (
    cd "${FRONTEND_DIR}" || exit 1
    PORT="${FRONTEND_PORT_VALUE}" npm run dev
  ) &
  frontend_pid=$!
}

print_summary() {
  cat <<SUMMARY
[dev-http] Stack is booting with HTTP defaults:
  • Frontend:  http://${FRONTEND_HOST}:${FRONTEND_PORT_VALUE}
  • Backend:   http://${BACKEND_HOST}:${BACKEND_PORT_VALUE}
  • Storage:   ${STORAGE_ENDPOINT}
  • API base:  ${NEXT_PUBLIC_API_BASE_URL}
  • TLS mode:  ${TREAZ_TLS_MODE}
Press Ctrl+C to stop both processes.
SUMMARY
}

start_backend
start_frontend
print_summary

wait -n || true
wait || true
