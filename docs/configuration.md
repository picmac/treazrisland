# Configuration Overview

This document lists the environment variables used by the Treazr Island services and points to the sample configuration files included in the repository.

## Templates

Two template files provide safe defaults for local development:

- `backend/.env.example`
- `frontend/.env.example`

Copy them to `.env` (backend) or `.env.local` (frontend) before running the bootstrap script or starting the services.

## Backend (`backend/.env`)

| Variable | Description |
| --- | --- |
| `NODE_ENV` | Execution environment for the Node.js backend (default `development`). |
| `PORT` | Port exposed by the backend service. |
| `DATABASE_URL` | PostgreSQL connection string used by the backend. |
| `REDIS_URL` | Redis connection string for caching and job queues. |
| `STORAGE_ENDPOINT` | Base URL for the MinIO object storage service. |
| `STORAGE_BUCKET` | MinIO bucket where generated assets are stored. |
| `STORAGE_ACCESS_KEY` | MinIO access key for the application. |
| `STORAGE_SECRET_KEY` | MinIO secret key for the application. |
| `EMULATOR_HOST` | Hostname for the LocalStack (AWS emulator) bridge. |
| `EMULATOR_PORT` | Port for the LocalStack (AWS emulator) bridge. |
| `PIXELLAB_API_TOKEN` | Token used by backend automations to call the Pixellab.ai API. |

## Frontend (`frontend/.env.local`)

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | HTTP base URL for API requests made from the web client. |
| `VITE_STATUS_PAGE_URL` | URL exposed by the backend that reports database and cache health. |
| `VITE_STORAGE_ENDPOINT` | HTTP endpoint that serves MinIO-hosted assets to the browser. |
| `VITE_STORAGE_BUCKET` | Asset bucket name expected by frontend storage helpers. |
| `VITE_PIXELLAB_PREVIEW_TOKEN` | Non-production token for previewing Pixellab.ai assets during development. |

## Bootstrap integration

The `scripts/bootstrap.sh` helper copies the example files into place if no `.env` files exist yet. Keep the templates updated whenever new configuration options are introduced.
