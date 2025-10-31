#!/usr/bin/env bash
set -euo pipefail

NGINX_CONTAINER_NAME="${NGINX_CONTAINER_NAME:-treazrisland-nginx}"
DOCKER_SOCK="${DOCKER_SOCK:-/var/run/docker.sock}"

if [[ ! -S "$DOCKER_SOCK" ]]; then
  echo "[certbot] docker socket $DOCKER_SOCK not available; skipping nginx reload" >&2
  exit 0
fi

PAYLOAD="/v1.41/containers/${NGINX_CONTAINER_NAME}/kill?signal=HUP"

curl --silent --show-error --fail \
  --unix-socket "$DOCKER_SOCK" \
  -X POST "http://localhost${PAYLOAD}" >/dev/null && \
  echo "[certbot] signalled $NGINX_CONTAINER_NAME to reload" || \
  echo "[certbot] failed to signal nginx container" >&2
