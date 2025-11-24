#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/treazrisland/treazrisland.git"
REPO_URL=${TREAZRISLAND_REPO_URL:-$REPO_URL_DEFAULT}
DEFAULT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  SOURCE_PATH="${BASH_SOURCE[0]}"
  if [[ -f "$SOURCE_PATH" && "$SOURCE_PATH" != /dev/* ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
    DEFAULT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
  fi
fi
REPO_DIR_DEFAULT=${TREAZRISLAND_DIR:-${DEFAULT_DIR:-"$PWD/treazrisland"}}
BRANCH_DEFAULT=${TREAZRISLAND_BRANCH:-main}
NONINTERACTIVE=${NONINTERACTIVE:-0}
REPO_DIR="$REPO_DIR_DEFAULT"
BRANCH="$BRANCH_DEFAULT"

log() {
  echo "[install] $*"
}

warn() {
  echo "[install][warn] $*" >&2
}

fail() {
  echo "[install][error] $*" >&2
  exit 1
}

detect_platform() {
  local uname_s
  uname_s=$(uname -s 2>/dev/null || echo "unknown")
  case "$uname_s" in
    Darwin)
      echo "macOS"
      ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "WSL"
      else
        echo "Linux"
      fi
      ;;
    *)
      echo "$uname_s"
      ;;
  esac
}

require_min_major() {
  local cmd="$1"
  local expected="$2"
  local label="$3"
  local hint="$4"
  local version

  version=$($cmd -v 2>/dev/null | tr -d 'v') || fail "Unable to read ${label} version."
  local major=${version%%.*}
  if (( major < expected )); then
    fail "${label} ${version} detected, but ${label} ${expected}.x or newer is required. ${hint}"
  fi
}

usage() {
  cat <<USAGE
Usage: local-setup.sh [options]

Options:
  --repo-dir <path>    Directory to clone/update the repo (default: ${REPO_DIR_DEFAULT})
  --branch <name>      Git branch or tag to checkout (default: ${BRANCH_DEFAULT})
  --non-interactive    Skip confirmation prompts (assumes yes)
  --help               Show this message

Environment overrides:
  TREAZRISLAND_REPO_URL   Alternate git remote
  TREAZRISLAND_BRANCH     Default branch
  TREAZRISLAND_DIR        Default repo directory
  NONINTERACTIVE=1        Non-interactive mode
USAGE
}

prompt_confirm() {
  local message="$1"
  if [[ "$NONINTERACTIVE" == "1" ]]; then
    return 0
  fi
  read -r -p "$message [y/N]: " response || return 1
  [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]
}

require_command() {
  local command_name="$1"
  local install_msg="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Missing dependency '$command_name'. ${install_msg}"
  fi
}

update_repo() {
  if [[ -d "$REPO_DIR/.git" ]]; then
    log "Repository already exists at ${REPO_DIR}. Fetching ${BRANCH}..."
    git -C "$REPO_DIR" fetch origin "$BRANCH"
    git -C "$REPO_DIR" checkout "$BRANCH"
    git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
  else
    log "Cloning ${REPO_URL} into ${REPO_DIR}..."
    git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  fi
}

run_repo_script() {
  local script_path="$1"
  if [[ ! -x "$script_path" ]]; then
    chmod +x "$script_path"
  fi
  bash "$script_path"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-dir)
        shift || fail "--repo-dir requires a path"
        REPO_DIR="$1"
        ;;
      --branch)
        shift || fail "--branch requires a value"
        BRANCH="$1"
        ;;
      --non-interactive)
        NONINTERACTIVE=1
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
    shift || true
  done
}

preflight_checks() {
  local platform
  platform=$(detect_platform)

  log "Running preflight checks for ${platform}..."

  require_command git "Install Git from https://git-scm.com/downloads."
  require_command docker "Install Docker Desktop or Engine from https://docs.docker.com/get-docker/."

  if ! docker info >/dev/null 2>&1; then
    case "$platform" in
      macOS)
        fail "Docker Desktop is not running. Launch it and wait for the green status indicator."
        ;;
      WSL)
        fail "Docker Desktop must be running on Windows with WSL integration enabled. Restart Docker Desktop if needed."
        ;;
      Linux)
        fail "Docker daemon is not active. Start it with 'sudo systemctl start docker' or refer to your distro documentation."
        ;;
      *)
        fail "Docker daemon is not active. Ensure Docker is running for your platform."
        ;;
    esac
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose V2 is unavailable. Upgrade Docker or install the compose-plugin."
  fi

  require_command node "Install Node.js 20.x LTS from https://nodejs.org/en/download or via a version manager."
  require_min_major node 20 "Node.js" "Upgrade to the latest LTS with nvm, fnm, or asdf."

  if ! command -v pnpm >/dev/null 2>&1; then
    warn "pnpm is not installed. Attempting to activate via corepack..."
    if command -v corepack >/dev/null 2>&1; then
      if corepack enable >/dev/null 2>&1 && corepack prepare pnpm@latest --activate >/dev/null 2>&1; then
        log "pnpm activated via corepack."
      else
        fail "pnpm activation failed. Run 'corepack enable && corepack prepare pnpm@latest --activate' manually."
      fi
    else
      fail "Install pnpm from https://pnpm.io/installation or install Node.js with corepack support enabled."
    fi
  fi

  require_min_major pnpm 8 "pnpm" "Upgrade with 'corepack prepare pnpm@latest --activate'."
}

main() {
  parse_args "$@"

  preflight_checks

  if [[ -d "$REPO_DIR" ]] && [[ ! -d "$REPO_DIR/.git" ]]; then
    warn "${REPO_DIR} exists but is not a Git clone."
    if prompt_confirm "Overwrite ${REPO_DIR}?"; then
      rm -rf "$REPO_DIR"
    else
      fail "Aborting to avoid clobbering ${REPO_DIR}."
    fi
  fi

  update_repo

  run_repo_script "$REPO_DIR/scripts/install/configure-env.sh"
  run_repo_script "$REPO_DIR/scripts/install/pull-containers.sh"

  log "Local environment prepared. Run './scripts/bootstrap.sh' from ${REPO_DIR} when you're ready to start the stack."
}

main "$@"
