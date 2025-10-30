#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROJECTS=(backend frontend)

for project in "${PROJECTS[@]}"; do
  WORKDIR="${REPO_ROOT}/${project}"
  printf '\n[ci] Running checks for %s\n' "${project}"
  pushd "${WORKDIR}" >/dev/null
  npm ci
  npm run lint
  npm test -- --run
  npm run build
  popd >/dev/null
  printf '[ci] %s checks completed\n' "${project}"
done
