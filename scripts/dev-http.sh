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

BACKEND_PORT_VALUE="${PORT:-${BACKEND_PORT:-3001}}"
FRONTEND_PORT_VALUE="${FRONTEND_PORT:-3000}"
DEFAULT_LISTEN_HOST="${LISTEN_HOST:-0.0.0.0}"
BACKEND_BIND_ADDRESS="${DEV_HTTP_BACKEND_BIND_ADDRESS:-${DEFAULT_LISTEN_HOST}}"
# Default the frontend bind address to match the backend so LAN devices can reach
# the Next.js dev server without extra overrides. Developers can still scope it
# down by exporting DEV_HTTP_FRONTEND_BIND_ADDRESS=127.0.0.1 explicitly.
FRONTEND_BIND_ADDRESS="${DEV_HTTP_FRONTEND_BIND_ADDRESS:-${DEFAULT_LISTEN_HOST}}"
LAN_IP="$(detect_lan_ip)"

if [[ -n "${TREAZ_DEV_LAN_HOST:-}" ]]; then
  LAN_IP="${TREAZ_DEV_LAN_HOST}"
fi

if [[ -n "${DEV_HTTP_BACKEND_HOST:-}" ]]; then
  BACKEND_HOST="${DEV_HTTP_BACKEND_HOST}"
elif [[ "${BACKEND_BIND_ADDRESS}" == "0.0.0.0" || "${BACKEND_BIND_ADDRESS}" == "::" ]]; then
  BACKEND_HOST="${LAN_IP:-localhost}"
else
  BACKEND_HOST="${BACKEND_BIND_ADDRESS}"
fi

if [[ -n "${DEV_HTTP_FRONTEND_HOST:-}" ]]; then
  FRONTEND_HOST="${DEV_HTTP_FRONTEND_HOST}"
elif [[ "${FRONTEND_BIND_ADDRESS}" == "0.0.0.0" || "${FRONTEND_BIND_ADDRESS}" == "::" ]]; then
  FRONTEND_HOST="${LAN_IP:-localhost}"
else
  FRONTEND_HOST="${FRONTEND_BIND_ADDRESS}"
fi

export LISTEN_HOST="${BACKEND_BIND_ADDRESS}"
BACKEND_URL_HOST="$(format_host_for_url "${BACKEND_HOST}")"
FRONTEND_URL_HOST="$(format_host_for_url "${FRONTEND_HOST}")"

if [[ -z "${NEXT_PUBLIC_API_BASE_URL:-}" || "${NEXT_PUBLIC_API_BASE_URL}" == "http://localhost:${BACKEND_PORT_VALUE}" ]]; then
  export NEXT_PUBLIC_API_BASE_URL="http://${BACKEND_URL_HOST}:${BACKEND_PORT_VALUE}"
fi

if [[ -z "${STORAGE_ENDPOINT:-}" || "${STORAGE_ENDPOINT}" == "http://localhost:9000" ]]; then
  export STORAGE_ENDPOINT="http://${BACKEND_URL_HOST}:9000"
fi

if [[ -z "${CORS_ALLOWED_ORIGINS:-}" || "${CORS_ALLOWED_ORIGINS}" == "http://localhost:${FRONTEND_PORT_VALUE}" ]]; then
  export CORS_ALLOWED_ORIGINS="http://${FRONTEND_URL_HOST}:${FRONTEND_PORT_VALUE}"
fi

if [[ -z "${NEXT_PUBLIC_MEDIA_CDN:-}" || "${NEXT_PUBLIC_MEDIA_CDN}" == "http://localhost:9000/treaz-assets" ]]; then
  export NEXT_PUBLIC_MEDIA_CDN="http://${BACKEND_URL_HOST}:9000/treaz-assets"
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
    LISTEN_HOST="${BACKEND_BIND_ADDRESS}" PORT="${BACKEND_PORT_VALUE}" npm run dev
  ) &
  backend_pid=$!
}

start_frontend() {
  echo "[dev-http] Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT_VALUE}"
  (
    cd "${FRONTEND_DIR}" || exit 1
    PORT="${FRONTEND_PORT_VALUE}" npm run dev -- --hostname "${FRONTEND_BIND_ADDRESS}"
  ) &
  frontend_pid=$!
}

print_summary() {
  cat <<SUMMARY
[dev-http] Stack is booting with HTTP defaults:
  • Frontend:  http://${FRONTEND_HOST}:${FRONTEND_PORT_VALUE} (binds ${FRONTEND_BIND_ADDRESS})
  • Backend:   http://${BACKEND_HOST}:${BACKEND_PORT_VALUE} (binds ${BACKEND_BIND_ADDRESS})
  • Storage:   ${STORAGE_ENDPOINT}
  • API base:  ${NEXT_PUBLIC_API_BASE_URL}
  • CORS:      ${CORS_ALLOWED_ORIGINS}
  • TLS mode:  ${TREAZ_TLS_MODE}
Press Ctrl+C to stop both processes.
SUMMARY
}

start_backend
start_frontend
print_summary

wait -n || true
wait || true
