# TREAZRISLAND

Self-hosted retro gaming portal blending a Fastify backend, Next.js frontend, and SNES-inspired
PixelLab.ai artwork. This repository contains infrastructure helpers, documentation, and the
application code for local development.

## Documentation Map

- [Product Requirements Document](./TREAZRISLAND_PRD.md)
- [Security & Threat Model](./docs/security/threat-model.md)
- [Integration Guides](./docs/integrations)
  - [ScreenScraper](./docs/integrations/screenscraper.md)

## Local Development

1. Copy `.env.example` to `.env` and populate secrets.
2. Start dependencies:

   ```bash
   docker compose -f infra/docker-compose.yml up postgres minio pixellab-mock
   ```

3. Follow backend/frontend README files (to be authored) for dev server commands.

