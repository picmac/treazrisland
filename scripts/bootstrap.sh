#!/usr/bin/env bash
set -euo pipefail

# Determine repository root relative to this script
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

die() {
  echo "[bootstrap] $1" >&2
  exit 1
}

inform() {
  echo "[bootstrap] $1"
}

inform "Starting Treazr Island development bootstrap..."

# Prerequisite checks
if ! command_exists docker; then
  die "Docker is not installed. Install Docker Desktop or Engine from https://docs.docker.com/get-docker/."
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose V2 is required. Update Docker to a version that includes 'docker compose'."
fi

if ! command_exists node; then
  die "Node.js is not installed. Install it via https://nodejs.org/en/download or a version manager."
fi

if ! command_exists pnpm; then
  die "pnpm is not installed. Install it via 'npm install -g pnpm' or see https://pnpm.io/installation."
fi

if ! command_exists curl; then
  die "curl is required for health checks. Install it via your package manager (brew, apt, etc.)."
fi

inform "All prerequisites detected."

copy_env_template() {
  local example_path="$1"
  local target_path="$2"

  if [[ -f "$example_path" ]]; then
    if [[ -f "$target_path" ]]; then
      inform "${target_path#$REPO_ROOT/} already exists. Skipping copy from ${example_path#$REPO_ROOT/}."
    else
      inform "Copying ${example_path#$REPO_ROOT/} to ${target_path#$REPO_ROOT/}..."
      cp "$example_path" "$target_path"
    fi
  else
    die "Expected to find env template at ${example_path#$REPO_ROOT/}, but it does not exist."
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
  local max_attempts=40
  local sleep_seconds=5
  local attempt=1

  if [[ ${#urls[@]} -eq 0 ]]; then
    die "wait_for_http_health requires at least one URL for $name"
  fi

  inform "Waiting for $name health (${urls[*]})..."
  while (( attempt <= max_attempts )); do
    for url in "${urls[@]}"; do
      if curl -fsS "$url" >/dev/null 2>&1; then
        inform "$name is healthy (attempt $attempt)."
        return 0
      fi
    done

    inform "$name health check attempt $attempt failed. Retrying in ${sleep_seconds}s..."
    ((attempt++))
    sleep "$sleep_seconds"
  done

  die "$name did not become healthy after $max_attempts attempts."
}

cd "$REPO_ROOT"

# Prepare environment files
template_env_files

# Install Node dependencies
inform "Installing Node dependencies with pnpm..."
pnpm install

# Apply database migrations and seed data
inform "Applying Prisma migrations..."
pnpm --filter backend prisma migrate deploy

inform "Seeding the database..."
pnpm --filter backend prisma db seed

# Start Docker services
COMPOSE_FILE="$REPO_ROOT/infrastructure/compose/docker-compose.yml"
inform "Starting Docker services (docker compose -f ${COMPOSE_FILE#$REPO_ROOT/} up -d emulator backend frontend)..."
docker compose -f "$COMPOSE_FILE" up -d emulator backend frontend

wait_for_http_health "emulator" "http://localhost:4566/health"
wait_for_http_health "backend" "http://localhost:4000/health"
wait_for_http_health "frontend" "http://localhost:5173/health" "http://localhost:5173"

inform "Treazr Island stack is healthy and ready!"
