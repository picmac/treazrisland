# Architecture Overview

This note captures how the Treazr Island stack is wired today and the near-term target architecture for the MVP refactor. It favors clarity over exhaustive detail so engineers can reason about boundaries quickly.

## Current System

- **Workspace:** `pnpm` monorepo with two primary packages (`backend`, `frontend`) and Playwright smoke tests under `tests/playwright`.
- **Frontend:** Next.js 16 (App Router, React 19) with a Pixellab-inspired theme. Client data fetching leans on lightweight fetch wrappers plus React Query for stateful flows. Vitest + Testing Library cover components and hooks.
- **Backend:** Fastify 5 with JWT auth, Redis-backed sessions, Prisma/PostgreSQL persistence, MinIO/S3-compatible object storage for ROM assets and avatars, and OpenTelemetry metrics. Routes are grouped by modules (auth, roms, users, admin, metrics) and expose JSON APIs plus a small GraphQL endpoint for users.
- **Data model:** Prisma schema defines Platforms, ROMs, Assets, Users, Invites, Sessions, SaveStates, and Favorites. Save states and ROM binaries live in object storage; relational data stays in Postgres.
- **Infrastructure:** Docker Compose stack (Postgres, Redis, MinIO, backend, frontend, emulator). `.env` values are loaded via `dotenv-flow` with typed parsing in `backend/src/config/env.ts`.
- **Testing/quality:** ESLint + Prettier, TypeScript `--noEmit` checks, Vitest suites in each package, and Playwright E2E helpers. Husky + lint-staged enforce formatting and related test runs on touched files.

## Target Architecture (MVP)

- **Frontend experience**
  - Shared design system (tokens, layout primitives, buttons/inputs/cards/tables/modals) with responsive breakpoints and WCAG-compliant focus states.
  - UX aligned to Nielsen Norman heuristics: visible status (loaders/toasts), forgiving flows (undo/cancel), consistent copy, and clear error recovery.
  - Data fetching consolidated through typed client wrappers + React Query for cache consistency; skeletons and optimistic UI on core flows (auth, library, favorites, uploads).
  - Emulator shell treated as a first-class route with save-state affordances and control overlays that work on mobile.
- **Backend platform**
  - Explicit layering: route handlers → services (business logic) → persistence/storage adapters. Schema validation at the edge (zod), structured error envelopes, and predictable status codes.
  - Hardened auth/session handling with refresh rotation, invite redemption guards, and rate limiting tuned per route group.
  - Object storage abstraction formalized (ROM + avatar uploads) with checksum enforcement and presigned URLs surfaced to the frontend.
  - Metrics and health endpoints remain lightweight but cover Redis, Postgres, and object storage buckets for operator visibility.
- **Observability and safety**
  - Pino logging with request correlation, OpenTelemetry exporters behind feature flags, and defensible defaults for secrets/config.
  - Test plan spans unit (services), integration (Fastify + Prisma testcontainers), and UI (Vitest + Playwright) with deterministic fixtures.

## Interaction Flow (happy path)

1. Operator hits `/onboarding`, runs health checks against `/health`, and completes admin profile/config saves via authenticated APIs.
2. Admin uploads ROM metadata → backend returns presigned upload grant → upload to MinIO → backend registers asset and ROM record.
3. Player logs in via invite or password, lands on library grid filtered by platform/genre/favorites, and opens a ROM detail page.
4. Starting a session requests play metadata (ROM asset URLs + save-state summary), hands off to EmulatorJS, and posts save/load events back to the API.

## Architectural Decisions to Respect

- Keep branding, naming, and licensing intact.
- Use TypeScript end-to-end with strict linting; keep English-only source and docs.
- Prefer incremental refactors that preserve behavior while improving clarity and testability.
