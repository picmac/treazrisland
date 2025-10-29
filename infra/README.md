# Infrastructure Assets

Target location for Docker Compose definitions, deployment manifests, and infrastructure automation supporting the self-hosted TREAZRISLAND stack.

## Secrets Management
ScreenScraper developer credentials are stored encrypted-at-rest. Generate encrypted blobs with `npm run screenscraper:encrypt` (see `docs/integrations/screenscraper.md`) and commit only the ciphertext. Inject the decryption key (`SCREENSCRAPER_SECRET_KEY`) via your secret manager or deployment pipeline; never store it in plaintext under version control.

## Local Services
Docker Compose files in this directory spin up dependencies such as Postgres, MinIO, and mock integrations. Ensure Docker is running locally before invoking `docker compose up`. With Docker available, Prisma migrations and integration tests depending on Postgres can now be executed directly on your workstation.
