#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra"

load_env_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    # shellcheck disable=SC1090
    source "${file}"
  fi
}

main() {
  cd "${REPO_ROOT}" || exit 1

  set -a
  load_env_file "${REPO_ROOT}/.env"
  set +a

  if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
    echo "[cloudflared] CLOUDFLARE_TUNNEL_TOKEN is not set. Export it or add it to .env before starting the tunnel." >&2
    exit 1
  fi

  cd "${INFRA_DIR}" || exit 1

  echo "[cloudflared] Starting tunnel with docker compose profile 'cloudflared'"
  docker compose --profile cloudflared up cloudflared "$@"
}

main "$@"
