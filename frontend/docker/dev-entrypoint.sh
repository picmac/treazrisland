#!/usr/bin/env bash
set -euo pipefail

PORT="${FRONTEND_PORT:-5173}"
HOST="${FRONTEND_HOST:-0.0.0.0}"

if [[ ! -f node_modules/.modules.yaml ]]; then
  echo "[frontend] Installing dependencies via pnpm"
  pnpm install --frozen-lockfile=false
fi

# Always start from a clean build to avoid stale chunk references across restarts.
rm -rf .next

# Turbopack is opt-in to avoid dev instability in CI.
NEXT_DEV_FLAGS=("--hostname" "${HOST}" "--port" "${PORT}" "--webpack")
if [[ "${NEXT_USE_TURBOPACK:-}" == "1" ]]; then
  NEXT_DEV_FLAGS=("--hostname" "${HOST}" "--port" "${PORT}" "--turbo")
fi

exec pnpm exec next dev "${NEXT_DEV_FLAGS[@]}"
