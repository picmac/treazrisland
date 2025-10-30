# TREAZRISLAND Frontend

This package contains the Next.js 19 (App Router) frontend for TREAZRISLAND. It delivers the SNES-inspired experience described in [`docs/TREAZRISLAND_PRD.md`](../docs/TREAZRISLAND_PRD.md) and provides a locally hosted EmulatorJS runtime for ROM playback.

## Getting started

```bash
cd frontend
npm install
npm run dev
```

The application renders App Router entries from `app/`. The player route lives at `/play/[romId]` and streams ROM binaries from the backend player API once authenticated.

## Library favorites & curation

- Use the star button on any ROM card within the platform detail grid to add it to your personal favorites. The toggle persists via the `/favorites` API and updates instantly in the UI.
- The platform view now includes a **Favorites only** switch that filters the virtualized grid to the ROMs you've starred.
- Collections (`/collections`) and top lists (`/top-lists`) exposed by the backend API will power future discovery surfaces in the UI. The new API clients live under `src/lib/api/`.

## EmulatorJS vendor workflow

The emulator bundle, WASM cores, and metadata are vendored into `public/vendor/emulatorjs/`. Run the helper script whenever you want to pull the latest upstream release:

```bash
# Optional: export GITHUB_TOKEN to increase rate limits
npm run update:emulator
```

The script downloads the latest release archive from [`EmulatorJS/EmulatorJS`](https://github.com/EmulatorJS/EmulatorJS), extracts it locally, and records release metadata in `treazrisland-emulatorjs.json`. Assets are served directly from the Next.js static file server to keep gameplay offline-first.

## Testing

- **Unit & component tests**: Vitest with React Testing Library powers the component and hook suites.

  ```bash
  npm test
  ```

  Add additional specs alongside their source files using the `.test.tsx` suffix.

- **Playwright smoke E2E**: follow the [Playwright smoke guide](../docs/testing/e2e.md) for prerequisites, then run the suite from this directory:

  ```bash
  RUN_SMOKE_E2E=1 npm run test:e2e:smoke
  ```

  The specs stub backend routes for deterministic flows while exercising the live Next.js UI.
