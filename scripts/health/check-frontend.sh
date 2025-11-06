#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to run this check" >&2
  exit 1
fi

echo "Checking frontend at ${FRONTEND_URL}..."
STATUS=$(curl -fsS -o /tmp/treaz-frontend.$$ -w "%{http_code}" "$FRONTEND_URL")
if [[ "$STATUS" != "200" ]]; then
  echo "Frontend health check failed (HTTP $STATUS)" >&2
  echo "Response body:" >&2
  cat /tmp/treaz-frontend.$$ >&2
  rm -f /tmp/treaz-frontend.$$
  exit 1
fi
rm -f /tmp/treaz-frontend.$$

echo "Frontend responded with HTTP $STATUS."
