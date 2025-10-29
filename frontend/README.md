# TREAZRISLAND Frontend

This package contains the Next.js 19 (App Router) frontend for TREAZRISLAND. It delivers the SNES-inspired experience described in [`docs/TREAZRISLAND_PRD.md`](../docs/TREAZRISLAND_PRD.md) and provides a locally hosted EmulatorJS runtime for ROM playback.

## Getting started

```bash
cd frontend
npm install
npm run dev
```

The application renders App Router entries from `app/`. The player route lives at `/play/[romId]` and streams ROM binaries from the backend player API once authenticated.

## EmulatorJS vendor workflow

The emulator bundle, WASM cores, and metadata are vendored into `public/vendor/emulatorjs/`. Run the helper script whenever you want to pull the latest upstream release:

```bash
# Optional: export GITHUB_TOKEN to increase rate limits
npm run update:emulator
```

The script downloads the latest release archive from [`EmulatorJS/EmulatorJS`](https://github.com/EmulatorJS/EmulatorJS), extracts it locally, and records release metadata in `treazrisland-emulatorjs.json`. Assets are served directly from the Next.js static file server to keep gameplay offline-first.

## Testing

Vitest with React Testing Library provides smoke coverage for the emulator player initialization hooks and save-state delegation:

```bash
npm test
```

Add additional component or hook specs alongside their source files using the `.test.tsx` suffix.
