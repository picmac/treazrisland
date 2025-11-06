#!/usr/bin/env bash
set -euo pipefail

STACK_FILE=${STACK_FILE:-docker-compose.yml}
SERVICE_NAME=${DB_SERVICE:-db}
DB_NAME=${POSTGRES_DB:-treazrisland}
DB_USER=${POSTGRES_USER:-treazrisland}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run this check" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required" >&2
  exit 1
fi

echo "Checking PostgreSQL service (${SERVICE_NAME}) health..."
PGPASSWORD=${POSTGRES_PASSWORD:-treazrisland} \
  docker compose -f "$STACK_FILE" exec -T "$SERVICE_NAME" \
  pg_isready -d "$DB_NAME" -U "$DB_USER" >/dev/null

echo "PostgreSQL responded from $SERVICE_NAME."
