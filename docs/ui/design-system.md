# UI Design System Cheatsheet

Quick reference for the shared Treazr Island UI primitives and tokens to keep new screens consistent with the Pixellab-inspired theme.

## Fonts & Tokens

- **Fonts:** `Space Grotesk` for display (`--pixellab-font-display` / `--font-pixellab`), `Manrope` for body copy (`--pixellab-font-body` / `--font-body`).
- **Colors:** `--pixellab-bg-primary` (deep navy), `--pixellab-accent` (teal), `--pixellab-accent-muted` (blue), `--pixellab-foreground` (off-white), `--pixellab-muted` (cool gray). Borders: `--pixellab-color-border-subtle` / `--pixellab-color-border-bold`.
- **Surfaces & layout:** `--pixellab-surface` / `--pixellab-surface-strong`, spacing scale `--pixellab-spacing-xxs…xl`, radii `--radius-sm/md/lg`, shadows `--shadow-soft/strong`, layout max width `--pixellab-layout-max-width`, padding `--pixellab-layout-padding`, and toolbar height `--pixellab-toolbar-height`.
- **Effects:** Grid settings via `--pixellab-grid-size` / `--pixellab-grid-opacity` and blur `--pixellab-panel-blur`. Backdrop textures live in `globals.css`.

## Core Components

- **Button (`frontend/src/components/ui/Button.tsx`)**
  - Variants: `primary`, `secondary`, `ghost`, `danger`; sizes: `md`, `lg`; supports `href` for link-like behavior.
  - Built-in loading state; accepts `icon` and `fullWidth`.
- **Card (`frontend/src/components/ui/Card.tsx`)**
  - Props: `eyebrow`, `title`, `description`, `tone` (`default`, `success`, `warning`, `danger`), `glow`, `actions`.
  - `as` prop switches between `section`/`article`/`div`.
- **FormField (`frontend/src/components/ui/FormField.tsx`)**
  - Provides label, description, hint, error, and input slot. Use for consistent spacing/ARIA.
- **StatusPill (`frontend/src/components/ui/StatusPill.tsx`)**
  - Tones: `info`, `success`, `warning`, `danger`; accepts optional `icon`.
- **SignOutButton (`frontend/src/components/ui/SignOutButton.tsx`)**
  - Client-side action to call `/auth/logout`, clear tokens, and surface inline status copy.
- **Layout primitives (`frontend/src/components/ui/layout.tsx`)**
  - `Stack` (column flex), `Cluster` (row/wrap), `Grid` (auto-fit or fixed columns), `Section` (centered width + padding) using shared spacing tokens.
- **Alert (`frontend/src/components/ui/Alert.tsx`)**
  - Banners with tones `info|success|warning|danger`, optional actions, and `dense` padding for inline status strips. Defaults to `role="status"`.

## Layout & Patterns

- **Navigation:** `PixellabNavigation` now accepts an `actions` slot (e.g., sign out). Keep link labels uppercase with 0.15rem letter spacing.
- **Pages:** Use `.page-shell` + `.page-content` from `globals.css` for consistent padding and textured backgrounds.
- **Status feedback:** Prefer `StatusPill` for inline cues and `Alert` for banners/inline statuses. Use `aria-live="polite"` on status text where appropriate.
- **Forms:** Apply `FormField` with descriptive copy and validation errors; pair with `Button` for primary actions and `ghost`/`secondary` for resets.
- **Empty states:** Offer a clear next action (e.g., upload CTA in the library grid) and brief guidance.

## Accessibility Notes

- Focus outlines use the accent color; avoid removing them.
- Ensure `aria-label`/`aria-describedby` on inputs via `FormField`.
- Use `role="status"` for non-error live updates and `role="alert"` for errors.

## Where to Extend

- Add new tokens to `frontend/src/theme/tokens.ts` and expose via `getPixellabCssVariables`.
- New primitives should live under `frontend/src/components/ui/` and include minimal props for tone/size/state.
