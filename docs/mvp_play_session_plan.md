# MVP Play Session Launch Plan

## Purpose

This plan outlines the fastest path to deliver a professional, self-hosted retro gaming experience where the very first operator can deploy locally and launch a game within minutes. It emphasises a Pixellab.ai-driven visual theme and borrows handheld-friendly layout cues from the ROMM project for EmulatorJS.

## Guiding Principles

1. **First session within 15 minutes:** The initial setup flow must take an operator from cloning the repo to playing a ROM in EmulatorJS with minimal manual steps.
2. **Pixellab.ai as the single source of visual truth:** All theme assets (backgrounds, sprites, typography treatments) should originate from Pixellab.ai generations to maintain a coherent art direction.
3. **Professional-grade developer experience:** Tooling, documentation, and automation need to mirror production-quality workflows so the MVP can evolve without rework.
4. **Security-first delivery:** Every change must follow secure coding guidelines and receive peer review before landing on the main branch.
5. **Documentation as a product:** Keep setup guides, architecture notes, and runbooks updated alongside code changes to avoid drift.
6. **State-of-the-art stack:** Default to the most recent LTS releases for runtimes, frameworks, and databases, and keep formatting/linting automation mandatory to maintain pristine code quality.

## Delivery Tracks

### 1. Local Runner Foundation

- Provide a Docker Compose stack with services for frontend, backend API, PostgreSQL, Redis (for sessions/job queues), and a minio-compatible object store for ROM binaries and generated art, each pinned to the current LTS tag.
- Offer a `./scripts/bootstrap.sh` that installs dependencies, copies `.env.example`, and invokes `docker compose up --build`.
- Include health checks and readiness probes for each container to prevent race conditions during the first boot, plus a dependency matrix that records the exact LTS version selected.
- Document hardware requirements (CPU, RAM, disk) and expected start-up time budgets so operators can validate their environment before starting.
- Publish a "first 10 minutes" screencast script to ensure walk-through parity across trainers and reviewers, and incorporate a quick verification step that the developer environment matches the documented LTS versions.

### 2. EmulatorJS Experience (ROMM-inspired)

- Embed EmulatorJS in a dedicated React route (`/play/:romId`) with a responsive layout that mirrors ROMM’s mobile view: toolbar pinned to the bottom, translucent overlay controls, and quick access to save/load state.
- Implement a “Session Prep” overlay that preloads BIOS/ROM files and surfaces controller mapping instructions before the emulator starts.
- Persist save states to object storage via signed URLs exposed by the backend.
- Provide ROMM-style layout tokens (`spacing.emulator`, `overlay.opacity`, `toolbar.height`) to prevent design drift when iterating on the UI.
- Add automated visual regression tests for the play route using Playwright screenshots to catch layout regressions early.

### 3. Library & Metadata Essentials

- Scaffold minimal Prisma models: `Platform`, `Rom`, `RomAsset`, `SaveState`, and `UserFavorite`.
- Provide seed data for one platform (e.g., SNES) and a placeholder ROM entry with upload instructions.
- Surface a library grid with virtualised rows and quick filters (Platform, Recently Played, Favorites) to reduce the time-to-first-launch.
- Attach content QA checklist (cover art resolution, description proofreading, Pixellab.ai attribution) to each ROM ingestion run.

### 4. Authentication & Invitations

- Implement passwordless email invitations using magic links (signed JWT with short TTL) and fallback admin password login.
- Store sessions in Redis with rolling refresh tokens to balance security and convenience for local deployments.
- Offer CLI utilities (`pnpm --filter backend create-admin`) to generate the first administrator without touching the database manually.
- Provide copy templates for invitation emails and onboarding tooltips so tone stays consistent with the brand voice.

### 5. Observability, Security & QA

- Integrate structured logging (Pino) and request tracing (OpenTelemetry) with exporters disabled by default but ready for production.
- Ship Playwright smoke tests covering: admin login, ROM upload, launch EmulatorJS, save state confirmation.
- Provide GitHub Actions workflows for linting, type-checking, and smoke tests on pull requests, with matrix jobs for each supported LTS runtime to flag drift immediately.
- Enforce a secure code review checklist covering dependency provenance, input validation, secret management, and infrastructure hardening before merges.
- Publish a changelog entry and update living documentation (architecture diagrams, ops runbooks) with every release candidate.
- Schedule weekly documentation hygiene reviews to keep setup guides, prompt catalogues, and architecture diagrams aligned.
- Establish an incident response dry run (simulate failed ROM upload, authentication breach attempt) before green-lighting the first public session.

## Pixellab.ai Asset Pipeline

1. **Prompt Library:** Maintain a `/docs/pixellab-prompts.md` catalog capturing effective prompts for backgrounds, UI chrome, and character art.
2. **Generation Automation:** Add a backend utility (`scripts/pixellab/pull_theme_assets.ts`) that authenticates with Pixellab.ai, requests the required assets, and writes them to `frontend/public/themes/pixellab/`.
3. **Asset Review:** Introduce a manual QA checklist to validate palette cohesion, accessibility (contrast ratios), and performance budgets (<500KB per asset where possible).
4. **TODO:** Acquire production-ready Pixellab.ai API tokens and schedule recurring generation to refresh seasonal art packs.

## Deployment Checklist for First Play

1. Clone repository and run `./scripts/bootstrap.sh` to start services.
2. Execute `pnpm --filter backend create-admin` from the backend container to issue the first admin invitation.
3. Upload a ROM through the admin dashboard or place a ROM file in `./data/import/` for auto-ingestion.
4. Browse to the library, tap the featured ROM, and launch the emulator.
5. Save state and confirm persistence by refreshing the page and resuming play.
6. Capture screenshots or recordings of the full flow for the launch logbook and share with reviewers for sign-off.
7. Update the runbook with any deviations observed during the walkthrough.

## Future Infrastructure Notes

- Prepare a follow-up iteration that introduces Cloudflare for edge security, caching, and DDoS mitigation once public endpoints are exposed.
- Evaluate Terraform or Pulumi modules for provisioning the Cloudflare configuration alongside core infrastructure.

## Risks & Mitigations

- **Asset Generation Latency:** Pixellab.ai requests may take time; cache generated assets and commit manifest JSON while keeping binaries out of the repo.
- **Mobile Usability:** EmulatorJS controls can feel cramped; adopt ROMM’s overlay spacing and test on 360px width breakpoints early.
- **Local Resource Footprint:** Running the stack may tax low-end machines; document resource requirements and offer a “lite” Compose profile (no Playwright container) for quick trials.
- **Documentation Drift:** Assign ownership for docs updates during review so the bootstrap guide and architecture references remain accurate.

## Next Actions

1. Finalise Docker Compose topology and bootstrap script.
2. Define Prisma schema and generate migration for core models.
3. Build React library grid and emulator route with ROMM-inspired layout tokens.
4. Implement Pixellab.ai asset fetcher and document prompt recipes.
5. Draft QA checklist for smoke tests and observability instrumentation.
6. Produce launch logbook template and dry-run rehearsal schedule.
7. Align the perfect start checklist with release criteria and keep sign-off evidence linked in the launch logbook.
