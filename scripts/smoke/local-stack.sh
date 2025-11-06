#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
STACK_FILE=${STACK_FILE:-docker-compose.yml}
DB_SERVICE=${DB_SERVICE:-db}
DB_NAME=${POSTGRES_DB:-treazrisland}
DB_USER=${POSTGRES_USER:-treazrisland}
MINIO_USER=${MINIO_ROOT_USER:-treaz-admin}
MINIO_PASSWORD=${MINIO_ROOT_PASSWORD:-treaz-secret}
ASSETS_BUCKET=${STORAGE_BUCKET_ASSETS:-treaz-assets}
ROMS_BUCKET=${STORAGE_BUCKET_ROMS:-treaz-roms}
BIOS_BUCKET=${STORAGE_BUCKET_BIOS:-treaz-bios}

"$ROOT_DIR/scripts/health/check-stack.sh"

echo "Verifying platform seed data..."
PLATFORM_COUNT=$(PGPASSWORD=${POSTGRES_PASSWORD:-treazrisland} \
  docker compose -f "$STACK_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -At -c 'SELECT COUNT(*) FROM "Platform";')
if [[ -z "$PLATFORM_COUNT" || "$PLATFORM_COUNT" -eq 0 ]]; then
  echo "Expected seeded platforms but query returned '$PLATFORM_COUNT'." >&2
  exit 1
fi

echo "Database reports $PLATFORM_COUNT platform rows."

echo "Checking MinIO buckets exist..."
MINIO_OUTPUT=$(docker compose -f "$STACK_FILE" run --rm --entrypoint /bin/sh minio-setup -c \
  "mc alias set treaz http://minio:9000 $MINIO_USER $MINIO_PASSWORD >/dev/null && mc ls treaz" )
for bucket in "$ASSETS_BUCKET" "$ROMS_BUCKET" "$BIOS_BUCKET"; do
  if ! printf '%s' "$MINIO_OUTPUT" | grep -q "$bucket"; then
    echo "Expected bucket '$bucket' to exist in MinIO." >&2
    echo "$MINIO_OUTPUT" >&2
    exit 1
  fi
  echo "Found bucket $bucket"
done

echo "Local stack smoke test succeeded."
