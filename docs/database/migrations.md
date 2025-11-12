# Database Migration Workflow

This guide outlines how to manage Prisma migrations for the Treazrisland backend service.

## Prerequisites

- Ensure the `DATABASE_URL` environment variable is configured for your target PostgreSQL database.
- Install backend dependencies: `pnpm install` from the repository root (or inside `backend/`).
- Generate the Prisma client before running the application.

## Generating the Prisma Client

Run the Prisma client generator any time the schema changes:

```bash
pnpm --filter @treazrisland/backend prisma:generate
```

This command wraps `pnpm prisma generate` and updates the local Prisma Client based on `backend/prisma/schema.prisma`.

## Creating a New Migration (Development)

1. Navigate to the backend workspace root: `cd backend`.
2. Create a migration:

   ```bash
   pnpm prisma:migrate:dev --name <migration-name>
   ```

   Replace `<migration-name>` with a descriptive identifier. This command creates a new migration file and applies it to your development database.

## Applying Migrations in Production-Like Environments

Use the deploy command to apply committed migrations without generating new ones:

```bash
pnpm --filter @treazrisland/backend prisma:migrate:deploy
```

## Checking Migration Status

To inspect the current migration state:

```bash
pnpm --filter @treazrisland/backend prisma:migrate:status
```

## Resetting the Development Database

If you need to rebuild your development database from scratch, run:

```bash
pnpm --filter @treazrisland/backend prisma:migrate:reset
```

> **Note:** This command drops the existing database before reapplying migrations. Use it only on disposable environments.
