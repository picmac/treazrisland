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
    inform "No ${example_path#$REPO_ROOT/} found. Skipping."
  fi
}

cd "$REPO_ROOT"

# Install Node dependencies
inform "Installing Node dependencies with pnpm..."
pnpm install

# Prepare environment files
copy_env_template "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
copy_env_template "$REPO_ROOT/backend/.env.example" "$REPO_ROOT/backend/.env"

# Start Docker services
inform "Building and starting Docker services (docker compose up --build)..."
docker compose up --build
