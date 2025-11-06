# TREAZRISLAND Frontend

Next.js 19 App Router client that renders the SNES-inspired experience described in [`TREAZRISLAND_PRD.md`](../TREAZRISLAND_PRD.md). The UI streams ROM binaries from the Fastify backend and runs EmulatorJS locally for fully self-hosted gameplay.

## Requirements

- Node.js 20 LTS and npm 10.
- A running backend at `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`).

## Environment setup

1. Ensure the repository-level `.env` file has the `NEXT_PUBLIC_*` keys populated (copy `.env.example` at the repo root if you haven't already).

2. Adjust the following keys when required:

   - `NEXT_PUBLIC_API_BASE_URL`: URL that proxies API calls in the browser and server components.
   - `NEXT_PUBLIC_PIXEL_THEME`: selects the pixel-art theme tokens. Keep `monkey-island` for the canonical SNES look.
   - `NEXT_PUBLIC_MEDIA_CDN`: optional absolute URL for serving artwork/ROM assets (defaults to the MinIO bucket from Docker Compose).

The Next.js config automatically loads the repository-level `.env`, so no additional files are required for development overrides. Local `.env` files inside `frontend/` remain optional if you prefer per-package overrides.

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

## Security headers & CSP maintenance

The App Router emits strict security headers for every route via [`next.config.ts`](./next.config.ts). The baseline policy enforces:

- `Content-Security-Policy` with `default-src 'self'`, ROM/media allowances, `report-uri /api/csp-report`, and automatic upgrades for mixed content.
- `Strict-Transport-Security` (two-year TTL with subdomain coverage and preload hint).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

Routes that still require inline scripts (for example, the EmulatorJS boot sequence under `/play/*`) receive a nonce-scoped CSP through [`middleware.ts`](./middleware.ts). Server components can read the nonce from the `x-csp-nonce` request header to attribute inline `<script>` tags without falling back to `unsafe-inline`.

When adding new external assets:

1. Update [`security-headers.ts`](./security-headers.ts) with the additional `img-src`, `connect-src`, or `media-src` directives, avoiding wildcards when possible.
2. Extend the Vitest suite in [`tests/security/security-headers.test.ts`](./tests/security/security-headers.test.ts) to cover the new directive so regressions are caught automatically.
3. Run `npm test` to confirm the integration coverage passes before shipping.

## API utilities

Client-side data fetching helpers live in `src/lib/api/`. Reuse these hooks before introducing new fetch logic to benefit from shared error handling and revalidation policies.
