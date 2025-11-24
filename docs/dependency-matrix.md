# Dependency Matrix

This matrix records the pinned Long-Term Support (LTS) or release versions we target across local tooling and infrastructure services. Keeping these values aligned avoids configuration drift between developer machines, automation, and runtime containers.

| Dependency                    | Source of Truth                                                                    | Pinned LTS / Release Version | Notes                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| Node.js                       | `package.json` (`engines.node`), `.github/workflows/ci.yml` (`actions/setup-node`) | 22.21.0                      | Latest LTS toolchain for local dev and CI.                    |
| pnpm                          | `package.json` (`engines.pnpm`, `packageManager`)                                  | 10.23.0                      | Matches the version installed in CI for consistent lockfiles. |
| PostgreSQL                    | `infrastructure/compose/docker-compose.yml` (`postgres` service)                   | 16-alpine                    | Tracks the latest 16.x patch via the Alpine image tag.        |
| Redis                         | `infrastructure/compose/docker-compose.yml` (`redis` service)                      | 7-alpine                     | Tracks the latest 7.2.x patch via the Alpine image tag.       |
| Playwright                    | Root `package.json` (`devDependencies.@playwright/test`)                           | 1.56.1                       | Browser automation stack used by E2E tests.                   |
| Prisma                        | `backend/package.json` (`dependencies.@prisma/client`, `devDependencies.prisma`)   | 7.0.0                        | ORM and migration tooling for the backend.                    |
| MinIO / S3-compatible storage | `infrastructure/compose/docker-compose.yml` (`minio` service)                      | RELEASE.2024-05-10T01-41-38Z | Mirrors production-compatible object storage locally.         |
| EmulatorJS embed server       | `infrastructure/emulator/Dockerfile` (`EMULATORJS_REF` build arg)                  | v4.2.3                       | Version of EmulatorJS baked into the embed build.             |
| Next.js                       | `frontend/package.json` (`dependencies.next`)                                      | 16.0.3                       | Frontend framework pinned to the stable channel.              |
| Fastify                       | `backend/package.json` (`dependencies.fastify`)                                    | 5.6.2                        | Backend HTTP server version used in production builds.        |

> ℹ️ For dependencies without an image tag (e.g., Node.js and pnpm), developer environments rely on the pinned versions listed in `package.json` and enforced through CI setup steps. Containerized dependencies inherit their tags directly from `infrastructure/compose/docker-compose.yml` and therefore reflect the same versions in local Docker Compose runs and E2E CI jobs.

## Validation

Our automated workflows keep this document from drifting:

- `pnpm run verify:lts` reads this matrix and asserts that the configured toolchain and container images match the pinned versions. It runs locally and as part of CI to catch drift early.
- `.github/workflows/ci.yml` pins Node.js 22.21.0 via `actions/setup-node` and installs pnpm 10.23.0 via `pnpm/action-setup` before running `pnpm install --recursive --frozen-lockfile`, ensuring the toolchain versions above are exercised in every lint, type-check, unit-test, and Playwright matrix job.
- The CI "Playwright" job invokes `scripts/test-e2e.sh`, which boots the Compose stack defined in `infrastructure/compose/docker-compose.yml`. This guarantees the PostgreSQL, Redis, MinIO, and EmulatorJS versions in the table match the containers that are health-checked before end-to-end tests run.
- Supporting workflows inside `.github/workflows/security-ack.yml` and `.github/workflows/security-checklist-ack.yml` gate PRs until the security checklist is acknowledged, which keeps dependency changes reviewed with the same rigor as the matrix updates documented here.
