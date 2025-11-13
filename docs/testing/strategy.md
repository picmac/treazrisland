# Testing Strategy

This repository uses a Vitest-based strategy for both the Next.js frontend and the Fastify backend.

## Tooling Overview

- **Frontend**: Vitest runs against the `src` directory with a jsdom environment, React Fast Refresh awareness via `@vitejs/plugin-react`, and Testing Library helpers configured through `vitest.setup.ts`.
- **Backend**: Vitest executes the API and domain tests in the `tests` directory using a Node environment with Fastify/Prisma helpers.
- **Coverage**: Both projects rely on the V8 coverage provider with shared thresholds (60% statements/lines/functions, 50% branches). Reports are written to each package's `coverage` directory in text and machine-readable formats so CI can enforce thresholds.

## Commands

| Scope | Command | Description |
| --- | --- | --- |
| Workspace | `pnpm test` | Runs the `test` script for every workspace (frontend and backend) in run mode with coverage thresholds enforced. |
| Workspace | `pnpm test:watch` | Runs `test:watch` in every workspace for interactive development feedback. |
| Frontend | `pnpm --filter treazrisland-frontend test` | Executes Vitest once with jsdom and Testing Library helpers. |
| Frontend | `pnpm --filter treazrisland-frontend test:watch` | Starts Vitest in watch mode for the frontend only. |
| Backend | `pnpm --filter @treazrisland/backend test` | Runs the Fastify/Prisma Vitest suite with coverage checks. |
| Backend | `pnpm --filter @treazrisland/backend test:watch` | Watches backend files and reruns affected Vitest suites. |

## Expectations for Contributors

1. **Write colocated tests** next to the code they verify (e.g., `Component.test.tsx` next to `Component.tsx`).
2. **Use Testing Library** for React components and `vitest` globals for utility modules.
3. **Keep coverage healthy**—new code should not drop the configured package thresholds.
4. **Document unusual test fixtures** in `docs/testing/` so others can understand the setup.
5. **Prefer `pnpm test` before committing** to ensure both frontend and backend still pass their suites locally.
