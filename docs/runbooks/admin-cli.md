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
pnpm --filter backend create-admin
```

The script prompts for:

- **Admin email** – must be unique and is normalised to lowercase.
- **Password** – captured securely (input is masked) and confirmed before submission. The stored value uses a bcrypt hash with
  12 rounds.

Successful execution only proceeds when the users table is empty to prevent accidental duplicate admins. The username and
display name default to the email prefix.

### Non-interactive flags

Pass `--email <address>` and `--password <value>` to run the command non-interactively (for example from CI or bootstrap
scripts). Invalid values stop execution before any database writes occur.

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
