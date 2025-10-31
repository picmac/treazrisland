#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NGINX_SMOKE_URL:-http://localhost}"
API_PATH="${NGINX_SMOKE_API_PATH:-/api/health}"
EXPECTED_STATUS="${NGINX_SMOKE_EXPECTED_STATUS:-ok}"

function require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python3

printf 'Checking frontend at %s... ' "$BASE_URL"
HTTP_CODE=$(curl -sk -o /tmp/nginx-frontend-response.$$ -w '%{http_code}' "$BASE_URL")
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "failed (HTTP $HTTP_CODE)"
  echo "Response body:" >&2
  cat /tmp/nginx-frontend-response.$$ >&2
  rm -f /tmp/nginx-frontend-response.$$
  exit 1
fi
rm -f /tmp/nginx-frontend-response.$$
echo "ok"

printf 'Checking API at %s%s... ' "$BASE_URL" "$API_PATH"
API_RESPONSE=$(curl -sk "$BASE_URL$API_PATH")
python3 - "$EXPECTED_STATUS" "$API_RESPONSE" <<'PYTHON'
import json
import sys

expected = sys.argv[1]
body = sys.argv[2]

try:
    payload = json.loads(body)
except json.JSONDecodeError:
    print("failed", file=sys.stderr)
    print(f"API did not return JSON: {body}", file=sys.stderr)
    sys.exit(1)

if payload.get("status") != expected:
    print("failed", file=sys.stderr)
    print(f"Unexpected status payload: {payload}", file=sys.stderr)
    sys.exit(1)
PYTHON
if [[ $? -ne 0 ]]; then
  echo "failed"
  exit 1
fi
echo "ok"

echo "All proxy smoke checks passed."
