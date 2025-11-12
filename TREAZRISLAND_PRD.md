# TREAZRISLAND – MVP Product Requirements Document

## Vision
Deliver a self-hosted retro gaming island where players can onboard quickly, browse a curated ROM library, and launch games within minutes of installation. The MVP focuses on single-player sessions with the groundwork for future multiplayer expansions.

## Goals
1. **Fast first play:** A new operator can install the stack, create the first admin, upload a ROM, and start playing within one hour.
2. **Delightful nostalgia:** Interfaces embrace a 16-bit, Monkey Island–inspired aesthetic with readable typography and playful copy.
3. **Player trust:** All gameplay happens locally with transparent data practices and strong authentication flows.
4. **Pixellab.ai-driven theming:** Every visual asset in the MVP is sourced through Pixellab.ai so the experience feels cohesive and professional from the first boot.

## Non-Goals
- Real-money transactions or marketplace features.
- Cloud-hosted infrastructure or proprietary third-party dependencies.
- Full netplay or online matchmaking in the initial release.

## Personas
- **Operator Pirate (Admin):** Installs the platform, manages content, and invites friends.
- **Deckhand Player:** Signs in with an invitation, browses the library, and launches games.

## Experience Pillars
1. **Guided Onboarding:** Streamlined steps for first admin setup and subsequent invite flows.
2. **Curated Library:** Metadata-rich browsing with favorites and recents for quick returns to beloved titles.
3. **Smooth Play:** EmulatorJS-powered sessions with save-state persistence and friendly recovery prompts.

## MVP Feature Breakdown
### 1. Installation & Setup
- Docker Compose stack for API, database, object storage, and frontend.
- Guided CLI script to seed `.env` files and run initial migrations.
- First-admin creation with secure password policy and email verification toggle.
- Bootstrap script must launch a **local runner** profile that brings up EmulatorJS alongside backend services so a ROM can be played immediately after setup.

### 2. Authentication & Accounts
- Invitation-based signup with optional magic link verification.
- Session management using secure cookies and refresh tokens.
- Profile editing for display name and avatar (upload via object storage).

### 3. Library Management
- Prisma-backed schema for Platforms, ROMs, Assets, Favorites, and SaveStates.
- Admin upload workflow with checksum validation and metadata entry.
- ROM listing API with filters (platform, genre, favorites) and pagination.

### 4. Player Experience
- Virtualized library grid highlighting favorites and recently played titles.
- ROM detail page with artwork, description, and “Play Now” call-to-action.
- EmulatorJS integration supporting keyboard/gamepad mappings and save/load state actions.
- Emulator layout should emulate ROMM’s mobile presentation, ensuring on-screen controls feel natural on smaller devices.

### 5. Observability & Safety
- Structured logging for auth, uploads, and play sessions.
- Rate limiting on auth and upload endpoints with alerting hooks.
- Basic metrics dashboard (health checks, ROM count, active sessions).
- Secure development lifecycle with documented coding guidelines and mandatory peer reviews before merges.

## Release Criteria
- Documented installation guide validated on macOS and Linux hosts.
- Automated test coverage for core APIs and UI flows (onboarding, upload, play session).
- Manual playtest sign-off covering first-admin setup through playing a ROM and saving progress, including verification that Pixellab.ai theme assets load correctly in the emulator view.
- Security review checklist completed for each release, and living documentation updated to reflect the current infrastructure and processes.
- Launch readiness checklist completed, covering bootstrap automation, observability dashboards, documentation updates, and green status on all gating pipelines.
- Operator onboarding pack reviewed and rehearsed (runbook dry run, disaster recovery drill, and EmulatorJS UX walkthrough recorded).
- Product owner approval that Pixellab.ai assets, copy, and localization strings meet the desired "day-one" quality bar.

## Future Considerations
- Netplay lobby and peer-to-peer session orchestration.
- ScreenScraper or community-driven metadata enrichment.
- Seasonal theming packs and narrative quests layered onto the library experience.
- Cloudflare integration for edge security hardening, caching, and DDoS protection once public deployments are introduced.
