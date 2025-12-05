#!/usr/bin/env bash
set -euo pipefail

export PNPM_FETCH_RETRIES="${PNPM_FETCH_RETRIES:-5}"
export PNPM_FETCH_RETRY_MINTIMEOUT="${PNPM_FETCH_RETRY_MINTIMEOUT:-5000}"
export PNPM_FETCH_RETRY_MAXTIMEOUT="${PNPM_FETCH_RETRY_MAXTIMEOUT:-60000}"
export PNPM_NETWORK_CONCURRENCY="${PNPM_NETWORK_CONCURRENCY:-1}"
export NPM_CONFIG_FETCH_RETRIES="$PNPM_FETCH_RETRIES"
export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="$PNPM_FETCH_RETRY_MINTIMEOUT"
export NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT="$PNPM_FETCH_RETRY_MAXTIMEOUT"
export NPM_CONFIG_NETWORK_CONCURRENCY="$PNPM_NETWORK_CONCURRENCY"

install_dependencies() {
  local attempts="${INSTALL_RETRIES:-3}"
  local delay="${INSTALL_RETRY_DELAY:-10}"
  local count=0

  echo "[backend] Installing dependencies via pnpm (ensures new deps are present)"

  until pnpm install \
    --frozen-lockfile=false \
    --prefer-offline \
    --fetch-retries "${PNPM_FETCH_RETRIES}" \
    --fetch-retry-maxtimeout "${PNPM_FETCH_RETRY_MAXTIMEOUT}" \
    --fetch-retry-mintimeout "${PNPM_FETCH_RETRY_MINTIMEOUT}" \
    --network-concurrency "${PNPM_NETWORK_CONCURRENCY}"; do
    count=$((count + 1))
    if (( count >= attempts )); then
      echo "[backend] pnpm install failed after ${count} attempts; giving up"
      return 1
    fi

    echo "[backend] pnpm install failed (attempt ${count}/${attempts}), retrying in ${delay}s"
    sleep "$delay"
  done
}

install_dependencies

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
