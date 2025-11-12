# Decision Record 001: Backend Framework

- **Date:** 2025-11-12
- **Status:** Accepted
- **Decision Makers:** Backend Foundations Working Group

## Context

We need a lightweight HTTP server to expose the initial Treazr Island backend APIs. The service should be fast to bootstrap, have a minimal runtime footprint, and align with TypeScript-first development. The stack must integrate cleanly with pnpm workspaces and leave room for future modularisation.

## Options Considered

1. **Fastify** – modern, low-overhead Node.js framework with great TypeScript support, schema-based validation, and a plugin ecosystem geared toward performance.
2. **NestJS** – batteries-included framework offering opinionated architecture, decorators, and dependency injection on top of Express or Fastify.

## Decision

Adopt **Fastify** as the backend framework. It keeps the server lean, pairs well with incremental feature delivery, and avoids the learning curve and structural overhead that NestJS would impose at this early stage.

## Consequences

- ✅ Fast development cycles with minimal boilerplate, enabling faster iteration on core APIs.
- ✅ First-class TypeScript types via Fastify's native definitions and schema tooling.
- ⚠️ We will assemble our own lightweight modules (configuration, routing, testing) instead of relying on NestJS generators.
- 🚀 Future work can layer structured patterns (e.g., modular routers, DI helpers) as needs grow without being locked into NestJS conventions.
