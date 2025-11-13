#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f node_modules/.modules.yaml ]]; then
  echo "[backend] Installing dependencies via pnpm"
  pnpm install --frozen-lockfile=false
fi

exec pnpm dev
