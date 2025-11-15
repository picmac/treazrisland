#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

require_docker

log "Pulling service dependencies defined in ${COMPOSE_FILE#$REPO_ROOT/}..."
docker compose -f "$COMPOSE_FILE" pull postgres redis minio emulator >/dev/null || true

log "Building frontend and backend development containers..."
docker compose -f "$COMPOSE_FILE" build frontend backend

log "Container images are ready for docker compose up."
