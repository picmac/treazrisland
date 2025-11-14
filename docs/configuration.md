# Configuration Overview

This document lists the environment variables currently used by the Treazr Island development stack and points to the sample configuration files included in the repository.

## Templates

Two template files provide safe defaults for local development:

- `.env.example`
- `backend/.env.example`

Copy them to `.env` (repository root) or `backend/.env` before running the bootstrap script or starting the services.

## Root (`.env`)

| Variable                       | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `NODE_ENV`                     | Execution environment shared by Docker Compose services (default `development`). |
| `BACKEND_PORT`                 | Port exposed by the backend container.                                           |
| `DATABASE_URL`                 | PostgreSQL connection string used by the backend container.                      |
| `JWT_SECRET`                   | Symmetric signing key for Fastify's JWT plugin (min length 32 characters).       |
| `REDIS_URL`                    | Redis connection string exposed to the backend container.                        |
| `OBJECT_STORAGE_ENDPOINT`      | Hostname for the MinIO object storage service (no protocol).                     |
| `OBJECT_STORAGE_PORT`          | Port exposed by the MinIO object storage service.                                |
| `OBJECT_STORAGE_USE_SSL`       | Set to `true` when MinIO is served over HTTPS; `false` otherwise.                |
| `OBJECT_STORAGE_ACCESS_KEY`    | MinIO access key for the application.                                            |
| `OBJECT_STORAGE_SECRET_KEY`    | MinIO secret key for the application.                                            |
| `OBJECT_STORAGE_BUCKET`        | MinIO bucket where generated assets are stored.                                  |
| `OBJECT_STORAGE_REGION`        | Region string assigned to the MinIO bucket.                                      |
| `OBJECT_STORAGE_PRESIGNED_TTL` | Expiration (seconds) for presigned object storage URLs.                          |
| `EMULATOR_HOST`                | Hostname for the LocalStack (AWS emulator) bridge.                               |
| `EMULATOR_PORT`                | Port for the LocalStack (AWS emulator) bridge.                                   |
| `FRONTEND_PORT`                | Port exposed by the frontend container.                                          |
| `NEXT_PUBLIC_API_BASE_URL`     | Public HTTP base URL exposed to the browser for API requests.                    |
| `NEXT_INTERNAL_API_BASE_URL`   | Internal HTTP base URL used by the frontend server (SSR/data fetching).          |
| `POSTGRES_USER`                | Username configured for the PostgreSQL service.                                  |
| `POSTGRES_PASSWORD`            | Password configured for the PostgreSQL service.                                  |
| `POSTGRES_DB`                  | Default database created for development.                                        |
| `POSTGRES_PORT`                | Host port published by the PostgreSQL container.                                 |
| `REDIS_PORT`                   | Host port published by the Redis container.                                      |
| `MINIO_ROOT_USER`              | Administrative user configured for the MinIO service.                            |
| `MINIO_ROOT_PASSWORD`          | Administrative password configured for the MinIO service.                        |
| `MINIO_PORT`                   | Host port published by the MinIO API.                                            |
| `MINIO_CONSOLE_PORT`           | Host port published by the MinIO console.                                        |
| `LOCALSTACK_SERVICES`          | Comma-separated list of LocalStack services to enable.                           |
| `LOCALSTACK_DEBUG`             | Enables verbose logging for LocalStack when set to `1`.                          |
| `LOCALSTACK_REGION`            | AWS region emulated by LocalStack.                                               |
| `LOCALSTACK_EDGE_PORT`         | Host port published by the LocalStack edge endpoint.                             |

## Backend (`backend/.env`)

| Variable   | Description                                                              |
| ---------- | ------------------------------------------------------------------------ |
| `NODE_ENV` | Execution environment for the Node.js backend (default `development`).   |
| `PORT`     | Port exposed by the backend service when running outside Docker Compose. |

## Bootstrap integration

The `scripts/bootstrap.sh` helper copies the example files into place if no `.env` files exist yet. Keep the templates updated whenever new configuration options are introduced.
