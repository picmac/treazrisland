# Dependency Matrix

This matrix records the pinned Long-Term Support (LTS) or release versions we target across local tooling and infrastructure services. Keeping these values aligned avoids configuration drift between developer machines, automation, and runtime containers.

| Dependency | Source of Truth                                               | Pinned LTS / Release Version | Container / Image Tag                    | Update Cadence                                                    |
| ---------- | ------------------------------------------------------------- | ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Node.js    | `.tool-versions`, `package.json` (`engines.node`)             | 20.14.0                      | N/A                                      | Review after each Node.js Active LTS release (roughly quarterly). |
| pnpm       | `.tool-versions`, `package.json` (`engines.pnpm`)             | 9.5.0                        | N/A                                      | Review alongside Node.js updates to keep toolchain in sync.       |
| PostgreSQL | `.tool-versions`, `infrastructure/compose/docker-compose.yml` | 16.3                         | postgres:16-alpine                       | Review quarterly for LTS patch releases.                          |
| Redis      | `.tool-versions`, `infrastructure/compose/docker-compose.yml` | 7.2.4                        | redis:7-alpine                           | Review quarterly for LTS patch releases.                          |
| MinIO      | `infrastructure/compose/docker-compose.yml`                   | RELEASE.2024-05-10T01-41-38Z | minio/minio:RELEASE.2024-05-10T01-41-38Z | Review monthly for upstream security advisories.                  |
| LocalStack | `infrastructure/compose/docker-compose.yml`                   | 3.5                          | localstack/localstack:3.5                | Review monthly for AWS API compatibility updates.                 |

> ℹ️ For dependencies without an image tag (e.g., Node.js and pnpm), developer environments rely on the pinned versions listed in `.tool-versions` and enforced through `package.json` engine constraints.
