# Hero Art Sourcing & Administration

This guide aligns the creative asset workflow with TREAZRISLAND&apos;s 16-bit aesthetic and privacy posture. Share it with administrators who manage the **Admin → Creative Assets** screen.

## Approved sources

1. **Original pixel art commissioned for TREAZRISLAND.** Prefer 16:9 canvases between 1280×720 and 1920×1080.
2. **In-house screenshots** captured from self-hosted ROMs. Crop to remove personal metadata and respect per-platform rating guidelines.
3. **Open-licensed imagery** (CC BY 4.0 or less restrictive). Keep attribution strings in `docs/brand/attributions.md`.

> Never ingest third-party artwork that is DRM-protected, watermarked, or missing license details. When in doubt, skip the upload and escalate to the art lead.

## Submission checklist

- [ ] Export as PNG or SVG with transparent edges trimmed.
- [ ] Name files using kebab-case (`super-nes-dusk.png`).
- [ ] Provide intrinsic dimensions and a one-line mood description inside the upload form.
- [ ] If the art replaces automated metadata, document the reason (seasonal event, limited drop, etc.).

## Placeholder usage

Until bespoke art is uploaded, the frontend serves `frontend/public/assets/hero/placeholder-hero.svg`. This fallback keeps the dashboard accessible, passes color contrast checks, and renders quickly in Chromatic snapshots.

## Quality bar

- Minimum contrast ratio: 4.5:1 between focal foreground elements and surrounding sky/ocean.
- Avoid pure black; lean on the `ink`, `night`, and `primary` palette tokens from `tailwind.config.ts` to stay on brand.
- Test responsive crops in the Creative Asset Manager before publishing.

## Incident response

1. Depublish the offending asset in the Admin UI.
2. Restore the placeholder hero art.
3. Create an Ops issue summarising the source, license gap, and any takedown timeline.
