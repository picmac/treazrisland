#!/usr/bin/env bash
set -euo pipefail

PORT="${FRONTEND_PORT:-5173}"
HOST="${FRONTEND_HOST:-0.0.0.0}"

echo "[frontend] Installing dependencies via pnpm (ensures new deps are present)"
pnpm install --frozen-lockfile=false --prefer-offline

# Always start from a clean build to avoid stale chunk references across restarts.
rm -rf .next

# Turbopack is opt-in to avoid dev instability in CI.
NEXT_DEV_FLAGS=("--hostname" "${HOST}" "--port" "${PORT}")
if [[ "${NEXT_USE_TURBOPACK:-}" == "1" ]]; then
  NEXT_DEV_FLAGS+=("--turbo")
fi

exec pnpm exec next dev "${NEXT_DEV_FLAGS[@]}"
