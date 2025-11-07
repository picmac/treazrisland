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
BACKEND_SERVICE=${BACKEND_SERVICE:-backend}
BACKEND_HEALTH_URL=${SMOKE_BACKEND_HEALTH_URL:-http://localhost:3001/health}
SMOKE_INVITE_EMAIL=${SMOKE_INVITE_EMAIL:-deckhand-smoke@example.com}
SMOKE_PLATFORM_SLUG=${SMOKE_PLATFORM_SLUG:-smoke-snes}
SMOKE_ROM_ID=${SMOKE_ROM_ID:-rom_smoke_demo}
SMOKE_SEED_COMMAND=${SMOKE_SEED_COMMAND:-npm run prisma:seed:smoke}

"$ROOT_DIR/scripts/health/check-stack.sh"

echo "Waiting for backend service ($BACKEND_SERVICE) to accept connections..."
attempt=0
until docker compose -f "$STACK_FILE" exec -T "$BACKEND_SERVICE" curl -sf "$BACKEND_HEALTH_URL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge 30 ]]; then
    echo "Backend health check did not succeed after $attempt attempts." >&2
    exit 1
  fi
  sleep 2
done

echo "Seeding deterministic smoke fixtures..."
seed_env=()
[[ -n "${SMOKE_INVITE_TOKEN:-}" ]] && seed_env+=("SMOKE_INVITE_TOKEN=$SMOKE_INVITE_TOKEN")
[[ -n "${SMOKE_INVITE_EMAIL:-}" ]] && seed_env+=("SMOKE_INVITE_EMAIL=$SMOKE_INVITE_EMAIL")
[[ -n "${SMOKE_PLATFORM_SLUG:-}" ]] && seed_env+=("SMOKE_PLATFORM_SLUG=$SMOKE_PLATFORM_SLUG")
[[ -n "${SMOKE_PLATFORM_ID:-}" ]] && seed_env+=("SMOKE_PLATFORM_ID=$SMOKE_PLATFORM_ID")
[[ -n "${SMOKE_ROM_ID:-}" ]] && seed_env+=("SMOKE_ROM_ID=$SMOKE_ROM_ID")
[[ -n "${SMOKE_ROM_TITLE:-}" ]] && seed_env+=("SMOKE_ROM_TITLE=$SMOKE_ROM_TITLE")
[[ -n "${SMOKE_ROM_STORAGE_KEY:-}" ]] && seed_env+=("SMOKE_ROM_STORAGE_KEY=$SMOKE_ROM_STORAGE_KEY")
[[ -n "${SMOKE_STORAGE_ROOT:-}" ]] && seed_env+=("SMOKE_STORAGE_ROOT=$SMOKE_STORAGE_ROOT")

docker compose -f "$STACK_FILE" exec -T "$BACKEND_SERVICE" env "${seed_env[@]}" $SMOKE_SEED_COMMAND

echo "Verifying smoke fixtures are present..."
INVITE_COUNT=$(PGPASSWORD=${POSTGRES_PASSWORD:-treazrisland} \
  docker compose -f "$STACK_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -At -c "SELECT COUNT(*) FROM \"UserInvitation\" WHERE email = '${SMOKE_INVITE_EMAIL}' AND \"redeemedAt\" IS NULL;")
if [[ "$INVITE_COUNT" -eq 0 ]]; then
  echo "Smoke invitation for ${SMOKE_INVITE_EMAIL} was not seeded." >&2
  exit 1
fi

PLATFORM_COUNT=$(PGPASSWORD=${POSTGRES_PASSWORD:-treazrisland} \
  docker compose -f "$STACK_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -At -c "SELECT COUNT(*) FROM \"Platform\" WHERE slug = '${SMOKE_PLATFORM_SLUG}';")
if [[ "$PLATFORM_COUNT" -eq 0 ]]; then
  echo "Smoke platform '${SMOKE_PLATFORM_SLUG}' is missing after seed." >&2
  exit 1
fi

ROM_COUNT=$(PGPASSWORD=${POSTGRES_PASSWORD:-treazrisland} \
  docker compose -f "$STACK_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -At -c "SELECT COUNT(*) FROM \"Rom\" WHERE id = '${SMOKE_ROM_ID}';")
if [[ "$ROM_COUNT" -eq 0 ]]; then
  echo "Smoke ROM '${SMOKE_ROM_ID}' is missing after seed." >&2
  exit 1
fi

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
