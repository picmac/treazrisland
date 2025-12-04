# UX Foundation Inventory (Slice 1)

Scope: audited current Pixellab UX layer, tokens, and UI components before starting the design-system refactor. Focused on frontend assets in `frontend/src/app`, `frontend/src/components`, and `frontend/src/theme`.

## Token & Theme Sources
- `frontend/src/theme/tokens.ts`: Static Pixellab tokens (background/accent/text/border, spacing/layout/effects, assets) + font imports (`Space Grotesk`, `Manrope`). Exposes `getPixellabCssVariables` but does not include surface/shadow/radius/breakpoints.
- `frontend/src/theme/pixellabTheme.ts` + `public/themes/pixellab/manifest.json`: Separate theme manifest path with fallback tokens using `Press Start 2P`; merges palette/spacing/typography but not tied to the CSS variables consumed in `globals.css`.
- `frontend/src/app/globals.css`: Hard-coded palette (`--pixellab-bg-primary`, `--pixellab-surface`, etc.), radii, shadows, breakpoints, and textured backgrounds. Values diverge from `PIXELLAB_TOKENS` and manifest tokens, creating parallel sources of truth.
- Docs drift: `docs/ui/design-system.md` references `Press Start 2P` + gold accent, but the active token file defaults to `Space Grotesk`/`Manrope` + aqua/teal palette.

## Layout & Chrome
- Global shell classes: `.page-shell` (textured background), `.page-content` (max-width/padding), `.status-banner`, `.skip-link`, `.eyebrow`, `.lede`.
- Chrome components: `PixellabNavigation` (sticky header; inline flex/image sizing), `PixellabTexture` (page wrapper with aurora + grid), `PixellabGrid` (auto-fit grid helper with inline styles), `PixellabThemeSurface` (demo surface with grid overlay + status copy).
- No shared layout primitives beyond the grid helper; most spacing/stacking is page-specific CSS.

## UI Primitive Inventory
- Buttons: `components/ui/Button` (`primary|secondary|ghost|danger`, `md|lg`, loading, href support). Inline-styled `SignOutButton` bypasses Button styles/variants.
- Cards: `components/ui/Card` (`tone`, `glow`, `eyebrow/title/description/actions`, `as`). Uses module CSS for surfaces and borders.
- Status: `StatusPill` (`info|success|warning|danger`) and global `.pill` class variants; subtle duplication.
- Form inputs: `FormField` (label/description/hint/error, default `<input>` with aria wiring). No shared select/textarea styles beyond this.
- Toasts: `ToastProvider` with simple stack, manual timeout, no motion/portal.
- Loading: `Skeleton`/`SkeletonStack` components plus `RomDetailSkeleton`; library grid uses virtualized rows.

## Flow-Specific Components (dependent on current styles)
- Library: `LibraryFilters` (module CSS, pills/radio/select), `LibraryGrid` (virtualized grid with inline transforms/heights/template-columns), `RomCard` (module CSS for badges/actions).
- Auth/onboarding/ROM detail/emulator shells: Styled primarily via `globals.css` classes (e.g., `.auth-card`, `.rom-hero`, `.play-session__*`) instead of reusable primitives.
- Image upload: `components/forms/ImageUploader` relies on `.image-uploader*` classes in `globals.css`; drag/drop and preview logic baked in.

## Inline Style Hotspots to Replace
- `app/page.tsx`: Overrides navigation background/border via inline `style`.
- `components/ui/SignOutButton.tsx`: Entire button styling inline instead of using `Button` variants.
- `components/chrome/PixellabNavigation.tsx`: Inline flex/gap wrapper and `Image` sizing.
- `components/chrome/PixellabTexture.tsx` & `PixellabGrid.tsx`: Background/grid + layout styles inline (good candidates for layout primitives).
- `components/theme/PixellabThemeSurface.tsx`: Grid background, typography, and spacing inline.
- `components/loading/SkeletonStack.tsx`: Gap handled via inline style.
- `app/(player)/library/LibraryGrid.tsx`: Inline `height`, `transform`, and `gridTemplateColumns` for virtualization rows/cards.

## Gaps / Risks to Address in Slice
- Dual token systems (manifest vs. static tokens vs. globals) create drift; fonts and palette differ between docs, manifest, and runtime.
- Surface/shadow/radius/breakpoint tokens live only in `globals.css`, not in the exported token object.
- No shared layout primitives (`Stack`, `Cluster`, `Grid`, `Section`), leading to repeated flex/grid snippets and inline styles.
- Focus affordances inconsistent: `LibraryGrid.module.css` references `.card` class that won’t match `RomCard` CSS module class names, so focus ring may not apply when navigating cards.
- Toasts/alerts/banners aren’t unified; multiple status patterns (`status-banner`, `StatusPill`, ad-hoc status divs) without shared props or tones.
- Docs lag current implementation, so contributors may follow the wrong font/palette guidance.
