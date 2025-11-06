#!/usr/bin/env bash
set -euo pipefail

BACKEND_HEALTH_URL=${BACKEND_HEALTH_URL:-http://localhost:3001/health}
EXPECTED_STATUS=${BACKEND_EXPECTED_STATUS:-ok}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to run this check" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse the backend health payload" >&2
  exit 1
fi

RESPONSE=$(curl -fsS "$BACKEND_HEALTH_URL")
STATUS=$(python3 - "$EXPECTED_STATUS" "$RESPONSE" <<'PYTHON'
import json
import sys

expected = sys.argv[1]
payload = sys.argv[2]

try:
    data = json.loads(payload)
except json.JSONDecodeError:
    print("", end="")
    sys.exit(2)

print(data.get("status", ""))
PYTHON
)

if [[ $? -eq 2 || -z "$STATUS" ]]; then
  echo "Backend health check failed. Response was not valid JSON: $RESPONSE" >&2
  exit 1
fi

if [[ "$STATUS" != "$EXPECTED_STATUS" ]]; then
  echo "Backend health check failed. Expected status '$EXPECTED_STATUS' but received '$STATUS'." >&2
  echo "Response payload: $RESPONSE" >&2
  exit 1
fi

echo "Backend health endpoint returned status '$STATUS'."
