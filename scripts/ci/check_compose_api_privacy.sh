#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${1:-infra/docker-compose.yml}

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "compose file '${COMPOSE_FILE}' not found" >&2
  exit 1
fi

python3 - "${COMPOSE_FILE}" <<'PY'
import sys
from pathlib import Path

compose_path = Path(sys.argv[1])
lines = compose_path.read_text().splitlines()

def collect_block(target: str, expected_indent: int) -> list[tuple[int, str]]:
    block: list[tuple[int, str]] = []
    inside = False
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not inside:
            if stripped == target and (len(line) - len(line.lstrip(' '))) == expected_indent:
                inside = True
            continue
        indent = len(line) - len(line.lstrip(' '))
        if stripped and indent <= expected_indent:
            break
        block.append((idx, line))
    if not block:
        raise SystemExit(f"expected block '{target}' with indent {expected_indent} in {compose_path}")
    return block

# Locate backend service block (two-space indentation for services)
backend_block = collect_block('backend:', 2)

# Ensure no ports mapping is defined for backend
for idx, line in backend_block:
    if line.strip().startswith('ports:'):
        lineno = idx + 1
        raise SystemExit(f"backend service must not expose host ports (line {lineno})")

# Ensure backend networks include backend_private
networks_indent = None
backend_networks: list[str] = []
for idx, line in backend_block:
    stripped = line.strip()
    indent = len(line) - len(line.lstrip(' '))
    if networks_indent is None:
        if stripped.startswith('networks:'):
            networks_indent = indent
        continue
    if stripped and indent <= networks_indent:
        break
    if stripped.startswith('-'):
        backend_networks.append(stripped[1:].strip())

if 'backend_private' not in backend_networks:
    raise SystemExit("backend service must attach to the backend_private network")

# Ensure backend_private network is declared and marked internal
found_network_section = False
network_indent = None
internal_true = False
networks_section_indent = None
for idx, line in enumerate(lines):
    stripped = line.strip()
    indent = len(line) - len(line.lstrip(' '))
    if networks_section_indent is None:
        if stripped == 'networks:' and indent == 0:
            networks_section_indent = indent
            continue
    if networks_section_indent is not None and stripped and indent <= networks_section_indent:
        break
    if not found_network_section:
        if stripped.startswith('backend_private:'):
            found_network_section = True
            network_indent = indent
        continue
    if stripped and indent <= network_indent:
        break
    if stripped.startswith('internal:'):
        value = stripped.split(':', 1)[1].strip().strip("\"'")
        if value.lower() == 'true':
            internal_true = True

if not found_network_section:
    raise SystemExit("backend_private network definition not found in compose file")

if not internal_true:
    raise SystemExit("backend_private network must be declared with internal: true")
PY
