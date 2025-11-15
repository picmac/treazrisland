# Compose Stack

This folder contains the local Docker Compose stack used for development. It creates the following services and wires them together on the `app` network while exposing HTTP traffic on the optional `traefik` network so local Traefik instances can route requests via the provided labels.

| Service      | Image                                      | Ports       | Purpose                                                                                   | Health command                                                        |
| ------------ | ------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `frontend`   | project build                              | 5173        | Vite/Next front-end with hot reload                                                       | `curl -f http://localhost:5173/health` (falls back to `/`)            |
| `backend`    | project build                              | 4000        | API plus background workers (receives `DATABASE_URL`, `REDIS_URL`, and MinIO credentials) | `curl -f http://localhost:4000/health`                                |
| `postgres`   | `postgres:16-alpine`                       | 5432        | Primary relational datastore                                                              | `docker compose exec postgres pg_isready -U ${POSTGRES_USER:-treazr}` |
| `redis`      | `redis:7-alpine`                           | 6379        | Caching and queueing                                                                      | `docker compose exec redis redis-cli ping`                            |
| `minio`      | `minio/minio:RELEASE.2024-05-10T01-41-38Z` | 9000 / 9001 | S3-compatible object storage (defaults to `minioadmin:minioadmin`, bucket `roms`)         | `curl -f http://localhost:9000/minio/health/live`                     |
| `emulatorjs` | `ghcr.io/linuxserver/emulatorjs:1.10.0`    | 8080        | Serves EmulatorJS static assets and its console UI                                        | `curl -f http://localhost:${EMULATORJS_PORT:-8080}/`                  |

## Notes

- The backend container inherits the `x-backend-environment` anchor so it automatically receives the `DATABASE_URL`, `REDIS_URL`, and MinIO-compatible credentials.
- EmulatorJS assets, database files, and node modules all use named volumes that you can prune safely with `docker volume rm` when you need a fresh start.
- Traefik integration is opt-in. If you run Traefik locally on the `traefik` network, the labels on the `frontend`, `backend`, and `emulatorjs` services will register routes (including `/health` paths) for easier diagnostics.
