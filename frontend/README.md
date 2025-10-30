# TREAZRISLAND Frontend

Next.js 19 App Router client that renders the SNES-inspired experience described in [`TREAZRISLAND_PRD.md`](../TREAZRISLAND_PRD.md). The UI streams ROM binaries from the Fastify backend and runs EmulatorJS locally for fully self-hosted gameplay.

## Requirements

- Node.js 20 LTS and npm 10.
- A running backend at `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`).

## Environment setup

1. Ensure the repository-level `.env` file has the `NEXT_PUBLIC_*` keys populated. Copy them into the Next.js local environment file:

   ```bash
   cp ../.env .env.local
   # or only export the public keys
   grep '^NEXT_' ../.env > .env.local
   ```

2. Adjust the following keys when required:

   - `NEXT_PUBLIC_API_BASE_URL`: URL that proxies API calls in the browser and server components.
   - `NEXT_PUBLIC_PIXEL_THEME`: selects the pixel-art theme tokens. Keep `monkey-island` for the canonical SNES look.
   - `NEXT_PUBLIC_MEDIA_CDN`: optional absolute URL for serving artwork/ROM assets (defaults to the MinIO bucket from Docker Compose).

Next.js automatically reloads when `.env.local` changes during development.

## Running the app

```bash
npm install
npm run dev             # http://localhost:3000
```

The App Router tree lives in `app/`. Key routes include:

- `/` – onboarding/login flows.
- `/library/[platformSlug]` – virtualised ROM grid with filters and favorites.
- `/play/[romId]` – EmulatorJS host that streams ROM binaries via the backend proxy.

For production builds:

```bash
npm run build
npm start               # serves the compiled output
```

## EmulatorJS vendor workflow

EmulatorJS assets are vendored into `public/vendor/emulatorjs/`. Update them when upstream releases new cores or bug fixes:

```bash
# Optional: export GITHUB_TOKEN to increase GitHub API rate limits
npm run update:emulator
```

The script downloads the latest `EmulatorJS/EmulatorJS` release, unpacks it, and records metadata in `treazrisland-emulatorjs.json`.

## Testing & linting

```bash
npm run lint            # ESLint with Next.js config
npm test                # Vitest + React Testing Library
RUN_SMOKE_E2E=1 npm run test:e2e:smoke   # Optional Playwright smoke suite
```

See [`docs/testing/e2e.md`](../docs/testing/e2e.md) for Playwright prerequisites and environment variables.

## API utilities

Client-side data fetching helpers live in `src/lib/api/`. Reuse these hooks before introducing new fetch logic to benefit from shared error handling and revalidation policies.
