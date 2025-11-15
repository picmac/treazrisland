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

main() {
  parse_args "$@"

  require_command git "Install Git from https://git-scm.com/downloads."

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
