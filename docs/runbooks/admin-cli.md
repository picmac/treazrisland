# Admin CLI Runbook

The backend exposes a pair of TypeScript command line utilities for performing privileged user management tasks. Each command
is executed with `pnpm` from the repository root and relies on a valid `DATABASE_URL` that points at the live Postgres
instance (local or production via secure tunnel).

## Prerequisites

1. Install project dependencies with `pnpm install` (run at the repo root).
2. Ensure the backend Prisma schema has been migrated and the target database is reachable.
3. Provide the usual environment used by the backend (e.g. `DATABASE_URL`) via `.env`, `.env.local`, or explicit variables. The
   CLI automatically loads files with `dotenv-flow`, matching the backend boot flow.

## Create an admin account

Run the helper to provision the first administrator:

```bash
pnpm cli:create-admin
```

The script prompts for:

- **Admin email** – must be unique and is normalised to lowercase.
- **Admin username** – defaults to the email prefix, must be unique, and only allows letters, numbers, and underscores.
- **Display name** – optional; blank answers fallback to the username.
- **Password** – captured securely (input is masked) and confirmed before submission. The stored value uses a bcrypt hash with
  12 rounds.

### Non-interactive overrides

Set any of the following environment variables to pre-fill the prompts (useful for automation). Invalid values will stop the
script before touching the database.

| Variable             | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `ADMIN_EMAIL`        | Email for the admin account.                           |
| `ADMIN_USERNAME`     | Username for the admin account.                        |
| `ADMIN_DISPLAY_NAME` | Optional display name.                                 |
| `ADMIN_PASSWORD`     | Plain text password that will be hashed before saving. |

## Generate manual invite codes

Run the invite generator to mint manual access codes:

```bash
pnpm cli:generate-invite
```

Prompts cover:

- **Invitee email (optional)** – reserve the code for a specific address.
- **Creator email (optional)** – link the invite to an existing user; validated against the users table.
- **Expiration (days)** – defaults to 7 days, enter `0` to create a non-expiring invite.

Successful execution prints the generated invite code plus metadata (reserved email, expiration, creator ID).

### Environment overrides

| Variable                 | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `INVITE_EMAIL`           | Optional invitee email constraint.                              |
| `INVITE_CREATOR_EMAIL`   | Email of an existing user to attribute as the creator.          |
| `INVITE_EXPIRES_IN_DAYS` | Non-negative integer controlling the expiry window (0 = never). |

Provide these variables to skip the interactive questions—for example when embedding the workflow inside higher-level
automation or CI jobs.
