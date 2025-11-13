#!/usr/bin/env bash
set -euo pipefail

PORT="${FRONTEND_PORT:-5173}"
HOST="${FRONTEND_HOST:-0.0.0.0}"

if [[ ! -f node_modules/.modules.yaml ]]; then
  echo "[frontend] Installing dependencies via pnpm"
  pnpm install --frozen-lockfile=false
fi

exec pnpm dev -- --hostname "${HOST}" --port "${PORT}"
