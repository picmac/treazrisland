#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

"$SCRIPT_DIR/check-db.sh"
"$SCRIPT_DIR/check-minio.sh"
"$SCRIPT_DIR/check-backend.sh"
"$SCRIPT_DIR/check-frontend.sh"

echo "All stack health checks passed."
