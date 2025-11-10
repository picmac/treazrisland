# TREAZRISLAND Backend

Fastify + Prisma service powering authentication, library management, emulator save states, and ScreenScraper enrichment. The backend exposes the REST/JSON APIs consumed by the Next.js frontend and is designed to run both locally and on a self-hosted stack.

## Requirements

- Node.js 22.21.1 LTS and npm 10.
- PostgreSQL 15+ (the `infra/docker-compose.yml` file provisions `postgres` automatically).
- MinIO or another S3-compatible object store for ROM/asset storage. Local development can fall back to the filesystem driver.

## Environment setup

1. Copy the repository-level environment file into this package so `dotenv` can load it:

   ```bash
   cp ../.env .env
   ```

2. Edit the following sections before running the server:

   - **Database**: `DATABASE_URL` must point at your PostgreSQL instance. The compose file uses `postgresql://treazrisland:treazrisland@localhost:5432/treazrisland?schema=public`.
   - **JWT + security**: set a unique `JWT_SECRET` for every deployment, tune the rate-limit values, and review password policy variables.
   - **Email**: supply SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USERNAME`/`SMTP_PASSWORD`) and a sender identity (`SMTP_FROM_EMAIL`, optional `SMTP_FROM_NAME`) if you expect password reset or invite emails to work. Leave the provider as `none` only in development.
   - **Storage**: choose between `STORAGE_DRIVER=filesystem` (requires `STORAGE_LOCAL_ROOT`) or `STORAGE_DRIVER=s3` (requires the MinIO/S3 settings from `.env.example`).
   - **ScreenScraper**: either populate `SCREENSCRAPER_USERNAME`/`SCREENSCRAPER_PASSWORD` directly for local experiments or use encrypted developer credentials (`npm run screenscraper:encrypt`).

The configuration contract is enforced by [`src/config/env.ts`](./src/config/env.ts); the process stops on invalid settings with a descriptive error.

## Database lifecycle

Prisma migrations live under `prisma/migrations/`. Keep the schema in sync with:

```bash
npm run prisma:migrate      # prisma migrate dev
npm run prisma:repair       # mark supported failed migrations as rolled back
npx prisma migrate deploy   # apply migrations in CI/production
npm run prisma:generate     # regenerate the Prisma client
npm run prisma:seed:platforms
npm run prisma:seed:roms
```

`npm run db:prepare` chains the repair, deploy, and platform seed steps together for automation scripts and Docker Compose jobs.

`npm run prisma:seed:platforms` loads the canonical platform catalogue required by the frontend to render browse views.
`npm run prisma:seed:roms` enriches that catalogue with representative ROM metadata, artwork, and curated top lists.

## Running the service

```bash
npm install
npm run dev            # start Fastify with TSX watcher on http://localhost:3001
```

Use `npm run build && npm start` to produce and run the compiled JavaScript bundle (used by the Dockerfile production stage).

The default routes include:

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /library/platforms`, `GET /library/platforms/:id/roms`
- `GET /player/roms/:id/binary`, `POST /player/roms/:id/state`
- `POST /admin/rom-uploads` (requires `ADMIN` role)

Refer to the OpenAPI schema in `src/routes` for request/response specifics.

## Quality checks

Run the suite before every commit:

```bash
npm run lint           # Prettier formatting check for curated files
npm test               # Vitest unit/integration tests
npm run build          # TypeScript compilation (tsc)
```

When debugging long-running local sessions, run `npm run dev -- --inspect` and attach your preferred Node inspector.

## Tooling scripts

- `npm run screenscraper:encrypt` – encrypt ScreenScraper credentials using AES-256-GCM; outputs Base64 text for `.env`.
- `npm run prisma:migrate` – iterative schema work during development.
- `npm run prisma:seed:platforms` – refresh the core platform catalogue.
- `npm run prisma:seed:roms` – populate ROM, asset, and top list exemplars for demos and testing.

See [`docs/observability/README.md`](../docs/observability/README.md) for guidance on consuming logs and metrics emitted by the backend.
