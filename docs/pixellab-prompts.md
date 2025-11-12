# Pixellab.ai Theme Prompt Catalogue

## Purpose
Curate reusable prompt templates that yield cohesive 16-bit assets for Treazrisland. All visual elements in the MVP must be generated through Pixellab.ai to uphold the requirement for a unified theme.

## Usage Guidelines
- Authenticate with Pixellab.ai using a project-specific API token (see TODO below) and capture the prompt ID + output manifest in `/frontend/public/themes/pixellab/manifest.json`.
- Maintain consistent palettes by reusing the same `seed` and `color_image` parameters when iterating on a component family.
- Document any manual post-processing steps (e.g., trimming transparent borders) alongside the prompt for repeatability.
- Submit prompt additions or edits through peer review to ensure adherence to secure coding and theming guidelines, and update related documentation immediately after changes land.
- Run each new asset through the accessibility gate (WCAG AA contrast check, color-blind simulation) and record the results in the manifest for future audits.
- Store low-resolution previews (webp or gif) alongside prompts for reviewers; full-resolution binaries remain in artifact storage per repository policy.
- Ensure automation scripts interacting with Pixellab.ai target the latest Node.js LTS release and pass linting/formatting checks before merging.

## Prompt Templates
### 1. Island Background Hero
```
Description: "sunset-lit pirate cove with voxel cliffs and neon signage"
View: "high top-down"
Guidance Scale: 5
Palette Reference: Upload previously approved UI chrome palette as `color_image`
Notes: request parallax-friendly layers by running multiple generations with slight camera offsets.
```

### 2. UI Chrome & Panels
```
Description: "sleek brass interface panels with rope accents and lcd glow"
View: "low top-down"
Guidance Scale: 7
Isometric: false
Notes: generate at 256x256, crop into slices for buttons, tabs, and cards.
```

### 3. Emulator Overlay Controls
```
Description: "touch controls inspired by 90s arcade cabinets, semi-transparent"
Direction: "south"
Guidance Scale: 4
Notes: request multiple opacity variants to cover bright and dark backgrounds.
```

### 4. Avatar & NPC Tokens
```
Description: "quirky crew member portraits with pixel art charm"
View: "side"
Seed: 1337
Notes: ensure square framing for compatibility with avatar slots and conversation UI.
```

### 5. Typography & Logo Treatments
```
Description: "pixel-serif logotype reading TREAZRISLAND with subtle tropical gradients"
Guidance Scale: 6
Palette Reference: upload approved UI chrome palette to enforce contrast parity
Notes: request alternate wordmark variants (horizontal, stacked) for responsive layouts.
```

## Relevant Pixellab.ai Endpoints
- **POST `/animate-with-skeleton`** – Generates layered pixel animations using reference art and skeleton keypoints; ideal for complex scene compositions when re-animating UI flourishes.【667adc†L8-L10】【8ac2c4†L31-L77】
- **POST `/animate-with-text`** – Produces 64x64 animated sprites from textual descriptions, useful for dynamic avatar sets and contextual UI feedback states.【8ac2c4†L79-L130】
- **POST `/estimate-skeleton`** – Extracts skeleton keypoints from a base image to accelerate animation tweaks for existing assets.【8ac2c4†L132-L165】

## TODO
- Secure Pixellab.ai production API token and store it as `PIXELLAB_API_TOKEN` in the deployment secrets manager.
- Add automated script to download generated assets into `frontend/public/themes/pixellab/` while skipping binaries in git.
- Establish review checkpoints for accessibility (contrast, legibility) and localisation readiness.
- Create a recurring task to audit this catalogue and associated manifests so documentation stays current with the generated asset set.
- Draft a launch-day art QA script (visual smoke test, theming spot check in EmulatorJS) and reference it in the launch readiness checklist.
- Document the runtime dependency matrix (Node.js, package managers, supporting CLIs) alongside the script to guarantee upgrades stay aligned with the latest LTS releases.
