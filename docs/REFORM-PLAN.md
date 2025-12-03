# Refactor & MVP Plan

Concise roadmap for hardening Treazr Island into a shippable MVP. Status values track progress across frontend, backend, and testing concerns.

## Current Status

- **Frontend:** Next.js app uses ad-hoc Pixellab styling with many inline rules. UX lacks consistent controls, loading/error states are uneven, and Nielsen Norman heuristics are only partially met (limited feedback and recovery paths). State management is split between local state and manual fetch calls.
- **Backend:** Fastify + Prisma stack is functional but mixes transport and domain logic in routes. Validation exists in places but error handling is inconsistent, and object storage/session flows need stronger safeguards and clearer responses.
- **Tests & quality:** Vitest suites exist for components, hooks, and services; coverage is spotty around new flows. Playwright helpers are present but not wired into local DX by default.

## Open Workstreams

- **Frontend**
  - Establish reusable design system (tokens, layout primitives, typography, buttons, inputs, cards, tables, modals).
  - Normalize loading/error/empty states and add accessibility + keyboard affordances.
  - Modernize library grid, ROM detail, onboarding, and auth flows with NN-heuristic alignment.
  - Prepare emulator shell with save-state indicators and control overlays ready for wiring.
- **Backend**
  - Enforce request validation, clearer service boundaries, and structured error payloads.
  - Harden auth (refresh rotation, invite redemption guards), profile updates, and avatar uploads.
  - Finalize ROM ingestion contracts (presigned uploads, checksum validation, platform/genre normalization) and save-state endpoints.
  - Improve health/metrics visibility and rate-limit defaults.
- **Tests**
  - Refresh unit/integration coverage for auth, roms, and onboarding APIs.
  - Strengthen frontend tests around onboarding wizard, library filters, and emulator prep UI.
  - Ensure lint/typecheck/test targets run green locally and in CI.

## MVP Feature Inventory

- **Implemented:** Auth (password + magic link + invites), admin bootstrap, ROM registration + listing + favorites, avatar upload grants, basic onboarding wizard, emulator control overlays, metrics + health endpoints.
- **Missing/In progress:** Polished library UX with filters/search, end-to-end ROM upload with presigned grants surfaced to UI, guided emulator configuration + play CTA, consistent profile completion flow, resilient save/load controls, and operator-friendly error feedback.

## Sprint-Sized Work Packages

1. **Design system + layout pass:** Introduce shared typography, color, spacing, and component primitives (buttons, inputs, cards, badges, tables, modals) with accessible focus and responsive grids.
2. **Landing/login revamp:** Rebuild home/login/onboarding shells with clear status indicators, progressive disclosure, and NN-heuristic-aligned copy; wire toast + inline validation helpers.
3. **Library & ROM detail:** Modernize library filters/grid with React Query, empty/slow states, and favorites; refresh ROM detail with action bar, metadata tabs, and save-state summary.
4. **Emulator prep UX:** Expose emulator configuration, control overlays, save-state indicators, and recovery guidance; ensure mobile-first layouts for play sessions.
5. **Auth & profile hardening:** Tighten backend validation, session rotation, invite redemption errors, profile/avatar updates; align frontend forms to new responses.
6. **ROM ingestion APIs:** Add upload grant endpoints, checksum enforcement, and safer admin routes; surface upload progress + validation in the UI.
7. **Observability & safety:** Normalize error envelopes, logging context, health/metrics responses, and rate-limit hooks; document operational runbooks.
8. **Testing sweep:** Expand Vitest coverage for services/components, refresh fixtures, and run lint/typecheck/test + Playwright smoke locally until green.

Statuses will be updated inline as work completes.
