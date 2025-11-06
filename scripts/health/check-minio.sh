#!/usr/bin/env bash
set -euo pipefail

MINIO_HEALTH_URL=${MINIO_HEALTH_URL:-http://localhost:9000/minio/health/ready}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to run this check" >&2
  exit 1
fi

echo "Checking MinIO at ${MINIO_HEALTH_URL}..."
STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" "$MINIO_HEALTH_URL")
if [[ "$STATUS" != "200" ]]; then
  echo "MinIO health check failed (HTTP $STATUS)" >&2
  exit 1
fi

echo "MinIO health endpoint returned HTTP $STATUS."
