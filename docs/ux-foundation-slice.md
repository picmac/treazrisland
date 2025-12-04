# UX Foundation & Design System Slice

Plan for the first refactor slice: establish a cohesive Pixellab-aligned design system, layout primitives, and global UX scaffolding without large rewrites.

## Objectives
- Unify tokens (color/typography/spacing/elevation/motion) and enforce consistent usage across pages.
- Ship reusable primitives (layout, buttons, inputs, cards, pills/badges, alerts, modals) with accessible focus and keyboard support.
- Normalize page shells (navigation, skip links, page spacing) and state patterns (loading/empty/error/success).
- Document patterns and validation steps to keep subsequent slices aligned.

## Scope (in) / Boundaries (out)
- In: Frontend-only work to consolidate theming, primitives, and global chrome; light docs updates.
- Out: Feature rewrites for library/onboarding/emulator flows; backend changes; net-new data fetching.

## Deliverables
- Token layer: normalized palette, typography scale, spacing/radius/shadow/motion tokens; asset manifest reference.
- Layout primitives: `Stack`, `Cluster`, `Grid`, `Section` wrappers with responsive gaps and semantic HTML defaults.
- UI components: button variants, input fields (text/select/textarea), status pills/badges, cards, alerts/banners, modal/sheet scaffold.
- Page chrome: skip link, header/nav using shared components, consistent focus rings, page max-width and spacing system.
- State patterns: skeletons/placeholders, empty/error banners with actions, inline validation messages.
- Documentation: short usage guide (MD/MDX) with examples and a checklist for reviewers.

## Work Breakdown (sequence)
1) Audit current tokens/styles/components; list inline style hotspots to replace. Artifact: component inventory.
2) Consolidate tokens (colors, typography, spacing, shadows, motion) into a single source; wire consumption via theme exports.
3) Build layout primitives (`Stack`, `Cluster`, `Grid`, `Section`) and migrate page shells to them.
4) Implement core UI components (buttons/links, inputs with labels/help/error, pills/badges, cards, alerts, modal scaffold) with focus states.
5) Add state patterns (skeletons, empty/error blocks, toast/banner consistency) and plug into landing shell as reference.
6) Document patterns in `docs/ui/` (usage, props, do/don’t) and add a quick visual/demo page if feasible.
7) Validation pass: lint/typecheck/unit tests for primitives; accessibility sweep for focus order, skip link, and color contrast on key pages.

## Validation Plan
- Commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and targeted Playwright smoke once key pages switch to new shells.
- Add component tests for interactive pieces (buttons, inputs, alerts/modals) covering focus/keyboard and variants.
- Contrast check on primary/secondary/ghost buttons, alerts, and banners; verify skip link and focus trap in modal.

## Risks / Dependencies
- Scope creep into feature flows—hold to shell/primitives first.
- Token churn affecting existing pages—stage migrations per page to avoid regressions.
- Need coordination with future slices (library/onboarding) to avoid duplicate patterns.

## Exit Criteria
- New token source of truth and layout/UI primitives exist and are used by the landing shell.
- Skip link, consistent focus rings, and state patterns are visible on at least one page.
- Tests/docs updated to reflect the new primitives; CI commands green locally.
