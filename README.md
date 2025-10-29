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

### PixelLab configuration

- Populate the PixelLab environment variables in `.env` before starting the backend:
  - `PIXELLAB_API_KEY` – API key issued by PixelLab.ai or the mock service.
  - `PIXELLAB_STYLE_ID` – default style applied when admin users request new hero art.
  - `PIXELLAB_BASE_URL` – defaults to the hosted API; point this at the mock server for local testing.
  - `PIXELLAB_CACHE_TTL` – duration string (`12h`, `1d`, etc.) that governs cache expiration.
  - `PIXELLAB_TIMEOUT_MS` – HTTP request timeout for render calls.
  - `PIXELLAB_ASSET_PREFIX` – folder prefix inside the asset bucket where renders are stored.
- The `pixellab-mock` service defined in `infra/docker-compose.yml` emulates the PixelLab REST API and returns placeholder PNGs.
  Export `PIXELLAB_BASE_URL=http://localhost:4010` when running the mock and keep the API key/style values in sync with the
  mock server’s configuration payloads.
- Cached renders are written to the asset bucket with metadata describing the prompt, style ID, and cache key. Admins can review
  cache health and render history from the `/admin/pixellab` dashboard.

## Emulator Playback Requirements

- Modern Chromium or Firefox builds are recommended for smooth canvas rendering and IndexedDB-backed save states. Safari
  remains experimental until we validate WebAssembly SIMD performance on Apple Silicon.
- ROM binaries stream through the Next.js proxy at `/api/player/roms/:id/binary`, which forwards authentication cookies and
  transparently follows signed URLs when `STORAGE_SIGNED_URL_TTL` is configured.
- Save states are persisted via the Fastify player API and stored in object storage. Maximum payload size and per-ROM limits
  are controlled through `PLAY_STATE_MAX_BYTES` and `PLAY_STATE_MAX_PER_ROM` in the environment configuration. Older states are
  trimmed automatically when the per-ROM limit is exceeded.

