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
- Capture prompt metadata (prompt id, `seed`, Pixellab model name, palette hash, preview URL) for every generation to ensure assets can be reproduced or rolled back.

## Prompt Metadata Schema
Record metadata in `frontend/public/themes/pixellab/manifest.json` so that every asset has a traceable lineage. Recommended fields:

| Field | Description | Example |
| --- | --- | --- |
| `prompt_id` | Pixellab reference for the generation job. | `plab-2024-06-hero-01` |
| `model` | Pixellab.ai model name/version to lock styling. | `pixel-core-v3` |
| `seed` | Integer seed that stabilises palette + dithering. | `874231` |
| `color_image` | Hash or URI of the palette reference used. | `s3://artifacts/palettes/ui-brass-v2.png` |
| `size` | Output resolution in pixels. | `512x288` |
| `layers` | Layer manifest describing parallax or UI slicing. | `["bg", "mid", "fg"]` |
| `review_status` | Result of the review checklist below. | `approved-aa` |
| `notes` | Free-form reminders about post-processing or usage. | `trimmed transparent border on left edge` |

Store the metadata adjacent to preview thumbnails and include links back to Notion/Jira tasks when relevant.

## Asset Categories & Sample Outputs
Use the categories below as the primary buckets for Treazrisland assets. Each category includes a template prompt and a sample description of the expected output so reviewers understand the target aesthetic.

### Backgrounds
- **Template Prompt**
  ```
  Description: "sunset-lit pirate cove with voxel cliffs and neon signage"
  View: "high top-down"
  Guidance Scale: 5
  Palette Reference: Upload previously approved UI chrome palette as `color_image`
  Notes: request parallax-friendly layers by running multiple generations with slight camera offsets.
  ```
- **Sample Output Description**: Layered 512x288 panorama featuring glowing shoreline beacons, misty parallax waves, and negative space reserved for HUD overlays; saved with `seed=51942`, `model=pixel-core-v3` for reuse in chapter intros.

### UI Frames & Chrome
- **Template Prompt**
  ```
  Description: "sleek brass interface panels with rope accents and lcd glow"
  View: "low top-down"
  Guidance Scale: 7
  Isometric: false
  Notes: generate at 256x256, crop into slices for buttons, tabs, and cards.
  ```
- **Sample Output Description**: 4-panel sprite sheet exporting beveled frames, pill buttons, and tab dividers at 2px padding; set `seed=78210`, `model=pixel-core-v3`, and document slicing coordinates for quick import into Tailwind sprites.

### Characters & Tokens
- **Template Prompt**
  ```
  Description: "quirky crew member portraits with pixel art charm"
  View: "side"
  Seed: 1337
  Notes: ensure square framing for compatibility with avatar slots and conversation UI.
  ```
- **Sample Output Description**: Batch of eight 128x128 portraits showing diverse pirates with assistive gear (hearing shells, monocles) to reinforce inclusive storytelling; generated via `model=pixel-core-v3`, `seed=1337`, with background transparency preserved for UI compositing.

## Prompt Templates
### 3. Emulator Overlay Controls
```
Description: "touch controls inspired by 90s arcade cabinets, semi-transparent"
Direction: "south"
Guidance Scale: 4
Notes: request multiple opacity variants to cover bright and dark backgrounds.
```

### 5. Typography & Logo Treatments
```
Description: "pixel-serif logotype reading TREAZRISLAND with subtle tropical gradients"
Guidance Scale: 6
Palette Reference: upload approved UI chrome palette to enforce contrast parity
Notes: request alternate wordmark variants (horizontal, stacked) for responsive layouts.
```

## Review Checklist
Before merging new prompts or regenerated assets, reviewers must complete the following checklist and record the status in the manifest metadata:

- [ ] WCAG AA contrast verified for light and dark UI contexts (document luminance ratios).
- [ ] Color-blind simulation (protanopia/deuteranopia/tritanopia) reviewed with no lost affordances.
- [ ] Interactive states (hover, pressed, disabled) documented for UI frames and controls.
- [ ] Localization-ready layouts confirmed (adequate padding for multi-language strings).
- [ ] Metadata (prompt ID, model, seed, palette reference, preview link) captured in `manifest.json`.
- [ ] Accessibility feedback from QA (if any) resolved or captured as TODO with owner.

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
