# TREAZRISLAND

Self-hosted retro gaming portal blending a Fastify backend, Next.js frontend, and SNES-inspired
PixelLab.ai artwork. This repository contains infrastructure helpers, documentation, and the
application code for local development.

## Documentation Map

- [Product Requirements Document](./TREAZRISLAND_PRD.md)
- [Security & Threat Model](./docs/security/threat-model.md)
- [Integration Guides](./docs/integrations)
  - [ScreenScraper](./docs/integrations/screenscraper.md)

## Authentication Model

- Fastify issues short-lived access JWTs and rotates HttpOnly `treaz_refresh` cookies on login and refresh. The cookie is
  limited to `SameSite=Lax` and marked `Secure` outside development.
- Refresh tokens are grouped into families. Refresh calls revoke the previous token in the family; logout revokes the entire
  family.
- The frontend never persists tokens to storage. A React `AuthProvider` keeps access tokens in memory and automatically calls
  `/auth/refresh` on mount to hydrate state. Consumers access session state via the `useSession` hook.
- Password reset links expire based on the new `PASSWORD_RESET_TTL` environment variable (default `1h`). Successful resets
  revoke all existing refresh families before issuing a new session.

## Local Development

1. Copy `.env.example` to `.env` and populate secrets.
2. Start dependencies:

   ```bash
   docker compose -f infra/docker-compose.yml up postgres minio pixellab-mock
   ```

3. Install backend dependencies, apply migrations, and seed the core platform catalog:

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run prisma:seed:platforms
   ```

4. Follow backend/frontend README files (to be authored) for dev server commands.

