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

cd "$REPO_ROOT"

# Install Node dependencies
inform "Installing Node dependencies with pnpm..."
pnpm install

# Prepare environment file
if [[ -f .env.example ]]; then
  if [[ -f .env ]]; then
    inform ".env already exists. Skipping copy from .env.example."
  else
    inform "Copying .env.example to .env..."
    cp .env.example .env
  fi
else
  inform "No .env.example found. Skipping environment file setup."
fi

# Start Docker services
inform "Building and starting Docker services (docker compose up --build)..."
docker compose up --build
