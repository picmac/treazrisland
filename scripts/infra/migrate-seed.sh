#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_STACK_FILE="${REPO_ROOT}/infra/docker-compose.yml"
STACK_FILE="${STACK_FILE:-${DEFAULT_STACK_FILE}}"
PROJECT_NAME="${TREAZ_COMPOSE_PROJECT_NAME:-treazrisland}"
ENV_FILE="${TREAZ_ENV_FILE:-${REPO_ROOT}/.env}"

if [[ ! -f "${STACK_FILE}" ]]; then
  echo "[migrate-seed] Unable to find compose file: ${STACK_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cat <<MSG >&2
[migrate-seed] Environment file not found at ${ENV_FILE}.
[migrate-seed] Copy .env.example to ${ENV_FILE} (or set TREAZ_ENV_FILE) before running migrations.
MSG
  exit 1
fi

echo "[migrate-seed] Applying Prisma migrations and seeding baseline data"
docker compose \
  --project-name "${PROJECT_NAME}" \
  --file "${STACK_FILE}" \
  run --rm backend-migrate

echo "[migrate-seed] Database is ready"
