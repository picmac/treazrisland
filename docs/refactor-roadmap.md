# Refactor Roadmap (UX/UI + Code Structure)

Concise, incremental plan to refactor Treazr Island into a shippable retro-gaming MVP without large rewrites. Anchored to Pixellab UX, strict TypeScript/React patterns, and backend safety.

## Guiding Principles
- Ship in slices that keep the app playable; avoid broad churn.
- Preserve accessibility: focus visibility, keyboard paths, contrast, and clear error/recovery affordances.
- Prefer shared primitives over page-level styling; remove one-off inline rules.
- Keep backend/domain logic isolated from transport; enforce validation and structured errors.
- Document decisions in PRs and update `docs/logbook` entries per slice.

## Priority Slices
1) **UX foundation + design system**
   - Frontend: Finalize tokens, typography, spacing, grid/layout primitives; unify buttons, inputs, cards, pills, alerts, modals; global skip links and focus rings.
   - Code structure: Centralize theming/hooks, consolidate CSS modules into component-scoped styles where needed, remove duplicated inline styles.
   - Deliverables: Storybook-like playground or MDX style guide, page shell + nav using shared components.

2) **Library + onboarding flows**
   - Frontend: Rebuild library grid with React Query, filters, skeleton/loading/empty states, and favorites toggles; onboarding checklist with progressive disclosure and validation.
   - Backend: Normalize library payloads (platform/genre enums, pagination, favorites), ensure onboarding status endpoints return structured statuses.
   - Deliverables: Library and onboarding pages powered by shared UI primitives, consistent toast/inline error patterns, typed client helpers.

3) **Emulator session shell**
   - Frontend: Session prep overlay, control legends, save/load indicators, connection status, mobile-friendly layout, pause/resume banners.
   - Backend: Save-state endpoints with checksum/validation, session health/heartbeat; consistent error envelopes for emulator interactions.
   - Deliverables: Play CTA flows from library → session shell, visible recovery steps for failures, telemetry hooks for session events.

4) **Auth, profile, and ROM ingestion hardening**
   - Frontend: Forms with field-level validation, inline/help text, success/failure states; avatar upload progress; invite redemption guidance.
   - Backend: Schema validation on all auth/profile/ingestion routes, refresh rotation + rate limits, presigned upload grants with checksum enforcement and platform normalization.
   - Deliverables: Updated SDK/client wrappers, contract tests for responses, documented error catalog for UI mapping.

5) **Observability, safety nets, and regression coverage**
   - Frontend: Status banners/toasts unified, error boundaries, optimistic update guards; accessibility audits.
   - Backend: Health/metrics endpoints hardened, structured logging contexts, rate-limit defaults per route family, tighter CORS/cookie settings.
   - Tests: Expand Vitest coverage for components/services, add Playwright smoke for onboarding → library → play, contract tests around ROM upload/auth flows.

## Validation & Tooling
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @treazrisland/playwright test` per slice.
- Add fixtures/fakes for new API contracts; keep fast unit tests for UI states (loading/error/empty).
- Capture UX deltas with before/after screenshots or recordings for review.

## Decision Logging
- For each slice, record scope, risks, and user-visible changes in PR descriptions.
- Update `docs/logbook` with completion notes and any follow-up debt.
