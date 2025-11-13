# Art Review Checklist

Establish a lightweight review flow so Treazrisland assets maintain a cohesive retro palette, fit the target display sizes, and remain accessible to all players. Complete this checklist whenever new art is proposed or existing work is revised.

## 1. Palette Consistency
- [ ] Palette source documented (prompt metadata, palette hash, or reference file).
- [ ] Primary, secondary, and accent colors compared to the approved UI palette to avoid drift.
- [ ] Dithering and gradient transitions inspected for banding when rendered on low-resolution displays.
- [ ] Color usage tested in both dark and light UI contexts to confirm contrast parity.

## 2. Size & Resolution Fit
- [ ] Asset dimensions listed (e.g., `512x288`) and mapped to the in-game placement or component slot.
- [ ] Sprite sheets include slice coordinates or padding notes so engineers can import them without guesswork.
- [ ] Responsive variants (desktop, handheld, HUD) captured when the component requires multiple sizes.
- [ ] File weight checked to ensure animation or parallax layers will not regress load-time targets.

## 3. Accessibility Verification
- [ ] WCAG AA contrast results recorded for critical text and interaction states.
- [ ] Color-blind simulations (protanopia, deuteranopia, tritanopia) reviewed to confirm affordances remain legible.
- [ ] Motion safety considered (limit flashing, note animation cadence for photosensitive users).
- [ ] Screen-reader or alt-text guidance drafted for any asset that will double as iconography.

## 4. Sign-off & Manifest Update
- [ ] Art lead or delegated reviewer signs off on the checklist above.
- [ ] Once approved, update `/frontend/public/themes/pixellab/manifest.json` with the new metadata and link back to this review.
- [ ] Reference the corresponding GitHub art approval issue so the audit trail remains intact.
