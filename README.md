# TREAZRISLAND

Self-hosted retro gaming portal blending a Fastify backend, Next.js frontend, and SNES-inspired
PixelLab.ai artwork. This repository contains infrastructure helpers, documentation, and the
application code for local development.

## Documentation Map

- [Product Requirements Document](./TREAZRISLAND_PRD.md)
- [Security & Threat Model](./docs/security/threat-model.md)
- [Integration Guides](./docs/integrations)
  - [Netplay](./docs/integrations/netplay.md)
  - [ScreenScraper](./docs/integrations/screenscraper.md)

## Local Development

1. Copy `.env.example` to `.env` and populate secrets.
2. Start dependencies:

   ```bash
   docker compose -f infra/docker-compose.yml up postgres minio pixellab-mock netplay-mock
   ```

3. Follow backend/frontend README files (to be authored) for dev server commands.

The optional `netplay-mock` container allows the frontend Netplay UI to exercise signaling flows without
access to the production Netplay service. Update `NETPLAY_SERVICE_BASE_URL` and the `NEXT_PUBLIC_*` Netplay
variables to target the mock (see [Netplay integration guide](./docs/integrations/netplay.md)).
