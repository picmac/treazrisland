#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f node_modules/.modules.yaml ]]; then
  echo "[backend] Installing dependencies via pnpm"
  pnpm install --frozen-lockfile=false
fi

apply_database_migrations() {
  if [[ "${SKIP_DB_MIGRATIONS:-0}" == "1" ]]; then
    echo "[backend] Skipping Prisma migrations (SKIP_DB_MIGRATIONS=1)"
    return
  fi

  echo "[backend] Applying Prisma migrations"
  pnpm prisma:migrate:deploy

  if [[ "${RUN_DB_SEED:-0}" == "1" ]]; then
    echo "[backend] Seeding database (RUN_DB_SEED=1)"
    pnpm prisma db seed
  fi
}

apply_database_migrations

exec pnpm dev
