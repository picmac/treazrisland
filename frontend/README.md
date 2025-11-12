# TREAZRISLAND Frontend

Next.js 14 App Router client that renders the SNES-inspired experience described in [`TREAZRISLAND_PRD.md`](../TREAZRISLAND_PRD.md). The UI streams ROM binaries from the Fastify backend and runs EmulatorJS locally for fully self-hosted gameplay.

## Requirements

- Node.js 22.11.0 LTS and npm 10.
- A running backend reachable from the browser. When no API host is configured, requests fall back to the page origin (e.g. the
  hostname serving the Next.js app).

## Environment setup

1. Ensure the repository-level `.env` file has the `NEXT_PUBLIC_*` keys populated. Copy them into the Next.js local environment file:

   ```bash
   cp ../.env .env.local
   # or only export the public keys
   grep '^NEXT_' ../.env > .env.local
   ```

2. Adjust the following keys when required:

   - `NEXT_PUBLIC_API_BASE_URL`: URL that proxies API calls in the browser and server components. If left undefined alongside
     `AUTH_API_BASE_URL`, API calls default to the browser origin.
   - `NEXT_PUBLIC_DEV_API_PORT`: optional override for the inferred backend port when the frontend runs on
     `http://<host>:3000`. Defaults to `3001` so phones and tablets on your LAN can reach the Fastify API without additional
     configuration.
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
npm start               # serves the compiled output (forces TREAZ_TLS_MODE=http on GitHub Actions)
# or
npm run start:lan        # binds 0.0.0.0 and forces TREAZ_TLS_MODE=http everywhere
```

The published Docker image uses the same helper, so you can run LAN-friendly previews with:

```bash
docker build -t treazrisland/frontend .
docker run --rm -p 3000:3000 treazrisland/frontend
```

Export `TREAZ_TLS_MODE=https` before running the container when deploying behind a TLS terminator so the security headers switch back to strict HTTPS mode.

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

## Security headers & CSP maintenance

The App Router emits strict security headers for every route via [`next.config.mjs`](./next.config.mjs). The baseline policy enforces:

- `Content-Security-Policy` with `default-src 'self'`, ROM/media allowances, `report-uri /api/csp-report`, and automatic upgrades for mixed content.
- `Strict-Transport-Security` (two-year TTL with subdomain coverage and preload hint).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

Every routed request receives a nonce-scoped CSP through [`proxy.ts`](./proxy.ts) so Next.js' inline bootstrap and the EmulatorJS boot sequence under `/play/*` can execute without resorting to `unsafe-inline`. Server components can read the nonce from the `x-csp-nonce` request header to attribute inline `<script>` tags safely.

When adding new external assets:

1. Update [`security-headers.mjs`](./security-headers.mjs) with the additional `img-src`, `connect-src`, or `media-src` directives, avoiding wildcards when possible.
2. Extend the Vitest suite in [`tests/security/security-headers.test.ts`](./tests/security/security-headers.test.ts) to cover the new directive so regressions are caught automatically.
3. Run `npm test` to confirm the integration coverage passes before shipping.

## API utilities

Client-side data fetching helpers live in `src/lib/api/`. Reuse these hooks before introducing new fetch logic to benefit from shared error handling and revalidation policies.
### Running the backend on another machine

When the backend API is hosted on a different device or hostname, define one of the following environment variables so both
client-side requests and server components resolve the correct origin:

- `NEXT_PUBLIC_API_BASE_URL` – recommended when the frontend must communicate with the backend from the browser. This value is
  exposed to client bundles.
- `AUTH_API_BASE_URL` – server-only equivalent used by the Next.js runtime. Use this when the browser should keep proxying via
  the frontend domain but server components need an absolute backend host.

If neither variable is present, API calls default to `window.location.origin` in the browser and derive the absolute host from
incoming request headers during server rendering. When the frontend is served from `:3000` in development, the client
automatically rewrites requests to `:3001` so other devices on the network can reach the Fastify backend without further setup.
Set one of the explicit variables above when the backend lives on another machine or listens on a non-standard port so
uploads, authentication, and server-rendered pages continue working.

