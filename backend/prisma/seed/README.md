# Prisma Seed Fixtures

This directory contains TypeScript helpers used by tests and manual scripts to populate the database with a consistent demo dataset. The dataset mirrors the SNES-focused slice of the PRD and now includes cooperative Netplay coverage.

## Entities

| Category | Records | Notes |
| --- | --- | --- |
| Users | 2 | Elaine (host) and Guybrush (guest) with deterministic IDs and argon2 demo hashes. |
| Platforms | 1 | Super Nintendo (SNES) baseline platform for sample ROMs. |
| ROMs | 2 | Chrono Trigger and Secret of Mana with size/hash metadata. |
| Netplay Sessions | 2 | One active lobby and one completed session, each with unique join codes and expiration windows. |
| Netplay Participants | 3 | Host + guest entries demonstrating HOST/GUEST roles and leftAt tracking for completed sessions. |

## Usage

Import the helpers from `prisma/seed/index.ts` and apply them via `PrismaClient` create calls in tests or seed scripts. The timestamps are anchored to `2024-01-05T20:00:00Z`, which keeps relational ordering deterministic for assertions.

Example:

```ts
import { PrismaClient } from "@prisma/client";
import { seedData } from "../prisma/seed";

const prisma = new PrismaClient();

await prisma.user.createMany({ data: seedData.users });
await prisma.platform.createMany({ data: seedData.platforms });
await prisma.rom.createMany({ data: seedData.roms });
await prisma.netplaySession.createMany({ data: seedData.netplaySessions });
await prisma.netplayParticipant.createMany({ data: seedData.netplayParticipants });
```

Remember to clear tables (or use transactions with truncation) when running fixtures repeatedly in tests.
