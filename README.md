# Treazr Island

Treazr Island is an early-stage retro-gaming platform experiment. This repository captures the foundational tooling, infrastructure scaffolding, and planning artefacts that support the MVP.

## Documentation

- [Dependency matrix](docs/dependency-matrix.md) — tracked versions for core tooling and services.
- Additional planning notes live in the [`docs/`](docs) directory while the product takes shape.

## Run commands

This monorepo uses `pnpm` for package management. Install the workspace dependencies and run the frontend scaffold with the following commands:

```bash
pnpm install         # install dependencies for every workspace package
pnpm --filter frontend dev   # launch the Pixellab-themed Next.js dev server
pnpm --filter frontend build # create a production build of the frontend
pnpm --filter frontend start # serve the production build locally
```

Additional scripts (linting, formatting, Husky hooks, etc.) are defined in the root `package.json` and automatically cover both the backend and frontend.
