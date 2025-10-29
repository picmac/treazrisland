# treazrisland

TREAZRISLAND is a self-hosted retro gaming stack that pairs curated ROM management with PixelLab-powered art direction. The project combines a Fastify backend, Next.js frontend, and optional integrations for art generation, metadata enrichment, and online netplay.

## Local development quick start

1. Copy `.env.example` to `.env` at the project root and customise the values for your environment.
2. Start supporting services:
   ```bash
   docker compose -f infra/docker-compose.yml up -d postgres minio pixellab-mock netplay-signal-mock
   ```
3. Install dependencies and run the backend/frontend applications following the instructions in their respective folders.

The `.env.example` file documents required secrets. For Netplay, populate `NETPLAY_SERVICE_BASE_URL`, `NETPLAY_SERVICE_API_KEY`, and adjust the session TTL bounds if your signaling service enforces different limits.

## Netplay integration overview

TREAZRISLAND communicates with an external signaling layer to coordinate peer-to-peer connections. A WireMock-powered stub (`netplay-signal-mock`) is provided for local iteration and exposes endpoints under `http://localhost:4100/v1/*`. The mock accepts session creation, join, and deletion flows and returns canned payloads so that frontend and backend code paths can be exercised without a live WebRTC broker.

See [`docs/integrations/netplay.md`](docs/integrations/netplay.md) for environment variables, API contracts, and rate limiting guidance. Operational logging and metrics expectations for Netplay lifecycle events are captured in [`docs/operations/netplay-observability.md`](docs/operations/netplay-observability.md).

## Security posture

Baseline security requirements, including authentication, hardening guidance, and now Netplay-specific threat considerations, are maintained in [`docs/security/README.md`](docs/security/README.md). Review that document before exposing services beyond localhost.
