#!/usr/bin/env bash
set -euo pipefail

# Determine repository root relative to this script
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -t 1 ]]; then
  COLOR_GREEN="\033[32m"
  COLOR_YELLOW="\033[33m"
  COLOR_RED="\033[31m"
  COLOR_BLUE="\033[34m"
  COLOR_RESET="\033[0m"
else
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_RED=""
  COLOR_BLUE=""
  COLOR_RESET=""
fi

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

die() {
  echo -e "[bootstrap] ${COLOR_RED}$1${COLOR_RESET}" >&2
  exit 1
}

inform() {
  echo -e "[bootstrap] ${COLOR_BLUE}$1${COLOR_RESET}"
}

success() {
  echo -e "[bootstrap] ${COLOR_GREEN}$1${COLOR_RESET}"
}

warn() {
  echo -e "[bootstrap] ${COLOR_YELLOW}$1${COLOR_RESET}" >&2
}

detect_os() {
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

require_command() {
  local cmd="$1"
  local hint="$2"
  if ! command_exists "$cmd"; then
    die "Missing dependency '${cmd}'. ${hint}"
  fi
}

ensure_docker_running() {
  if ! docker info >/dev/null 2>&1; then
    local platform_hint
    case "$PLATFORM" in
      macOS)
        platform_hint="Open Docker Desktop and wait until it reports 'running'."
        ;;
      WSL)
        platform_hint="Start Docker Desktop on Windows, ensure WSL integration is enabled, then retry."
        ;;
      Linux)
        platform_hint="Start the daemon with 'sudo systemctl start docker' or consult your distro's docs."
        ;;
      *)
        platform_hint="Ensure the Docker daemon is active for your platform."
        ;;
    esac
    die "Docker daemon is not running. ${platform_hint}"
  fi
}

require_min_version() {
  local cmd="$1"
  local required_major="$2"
  local display_name="$3"
  local hint="$4"
  local version

  version=$($cmd -v 2>/dev/null | tr -d 'v') || die "Unable to read ${display_name} version."
  local major=${version%%.*}
  if (( major < required_major )); then
    die "${display_name} ${version} detected, but ${display_name} ${required_major}.x or newer is required. ${hint}"
  fi
}

PLATFORM=$(detect_os)
inform "Starting Treazr Island development bootstrap on ${PLATFORM}..."

# Prerequisite checks
require_command docker "Install Docker Desktop or Engine from https://docs.docker.com/get-docker/."
require_command curl "Install curl via your package manager (brew, apt, etc.)."
require_command node "Install Node.js 20.x LTS from https://nodejs.org/en/download or via a version manager."
require_command pnpm "Activate pnpm via 'corepack enable' or install from https://pnpm.io/installation."
require_min_version node 20 "Node.js" "Switch to the latest LTS using nvm, fnm, or asdf."
require_min_version pnpm 8 "pnpm" "Run 'corepack prepare pnpm@latest --activate' to upgrade."

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose V2 is required. Update Docker to a version that includes 'docker compose'."
fi

ensure_docker_running

success "All prerequisites detected and the Docker daemon is running."

EMULATORJS_PORT="${EMULATORJS_PORT:-8080}"

copy_env_template() {
  local example_path="$1"
  local target_path="$2"

  if [[ -f "$example_path" ]]; then
    if [[ -f "$target_path" ]]; then
      inform "${target_path#"$REPO_ROOT"/} already exists. Skipping copy from ${example_path#"$REPO_ROOT"/}."
    else
      inform "Copying ${example_path#"$REPO_ROOT"/} to ${target_path#"$REPO_ROOT"/}..."
      cp "$example_path" "$target_path"
    fi
  else
    die "Expected to find env template at ${example_path#"$REPO_ROOT"/}, but it does not exist."
  fi
}

template_env_files() {
  local template_dir="$REPO_ROOT/infrastructure/env"
  declare -A env_templates=(
    ["$REPO_ROOT/.env"]="$template_dir/root.env.example"
    ["$REPO_ROOT/backend/.env"]="$template_dir/backend.env.example"
  )

  inform "Templating environment files..."
  for target_path in "${!env_templates[@]}"; do
    copy_env_template "${env_templates[$target_path]}" "$target_path"
  done
}

wait_for_http_health() {
  local name="$1"
  shift
  local urls=("$@")
  local max_attempts=${BOOTSTRAP_HEALTH_ATTEMPTS:-40}
  local sleep_seconds=${BOOTSTRAP_HEALTH_SLEEP:-5}
  local attempt=1
  local last_error=""

  if [[ ${#urls[@]} -eq 0 ]]; then
    die "wait_for_http_health requires at least one URL for $name"
  fi

  inform "Waiting for $name health (${urls[*]})..."
  while (( attempt <= max_attempts )); do
    for url in "${urls[@]}"; do
      if output=$(curl -fsS -w ' (status: %{http_code})' -o /dev/null "$url" 2>&1); then
        success "$name is healthy (attempt $attempt)."
        return 0
      else
        last_error="curl check for ${url} failed: ${output:-"curl exited $?"}"
      fi
    done

    warn "$name health check attempt $attempt failed${last_error:+: $last_error}. Retrying in ${sleep_seconds}s..."
    ((attempt++))
    sleep "$sleep_seconds"
  done

  die "$name did not become healthy after $max_attempts attempts.${last_error:+ Last error: $last_error}"
}

cd "$REPO_ROOT"

# Prepare environment files
template_env_files

success "Environment templates ready."

# Install Node dependencies
inform "Installing Node dependencies with pnpm (respecting pnpm-lock.yaml)..."
pnpm install --frozen-lockfile
success "Node dependencies installed."

# Start infrastructure dependencies first so migrations have a live database
COMPOSE_FILE="$REPO_ROOT/infrastructure/compose/docker-compose.yml"
inform "Starting infrastructure services required for migrations (postgres, redis, minio, emulatorjs)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis minio emulatorjs

inform "Waiting for postgres, redis, and minio to report healthy..."
docker compose -f "$COMPOSE_FILE" wait postgres redis minio >/dev/null
wait_for_http_health "emulatorjs" "http://localhost:${EMULATORJS_PORT}/healthz"

# Apply database migrations and seed data now that dependencies are running
inform "Applying Prisma migrations..."
pnpm --filter backend prisma migrate deploy
success "Prisma migrations applied."

inform "Seeding the database..."
pnpm --filter backend prisma db seed
success "Database seeded."

# Start remaining Docker services
inform "Starting Docker services (docker compose -f ${COMPOSE_FILE#"$REPO_ROOT"/} up -d backend frontend)..."
docker compose -f "$COMPOSE_FILE" up -d backend frontend

wait_for_http_health "emulatorjs" "http://localhost:${EMULATORJS_PORT}/healthz"
wait_for_http_health "backend" "http://localhost:4000/health"
wait_for_http_health "frontend" "http://localhost:5173/health" "http://localhost:5173"

success "Treazr Island stack is healthy and ready!"
