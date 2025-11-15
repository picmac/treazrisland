# Emulator viewport QA notes

This checklist documents how to verify the responsive viewport and touch controls that now wrap the EmulatorJS runtime.

## Feature flags

Two optional environment switches control the new UI layers when running `frontend` locally:

- `NEXT_PUBLIC_ENABLE_VIEWPORT_SCALE` (default: `true`) — toggles the responsive scaling hook.
- `NEXT_PUBLIC_ENABLE_TOUCH_OVERLAY` (default: `true`) — toggles the on-screen controller.

Disabling either flag falls back to the original fixed canvas or removes the touch overlay entirely, which is helpful when comparing regressions.

## Scaling validation

1. Start the dev server via `pnpm --filter treazrisland-frontend dev`.
2. Visit `/play/:romId` with a seeded ROM.
3. Resize the browser window and rotate a mobile simulator. The `.play-session__viewport` element should fill the `.play-session__stage` without warping its 4:3 ratio.
4. Inspect the DOM — the wrapper exposes CSS custom properties `--emulator-scale`, `--emulator-base-width`, and `--emulator-base-height` for debugging.

## Touch overlay validation

1. Load the same play page on a touch-capable device or simulator.
2. Confirm that the translucent D-pad, ABXY cluster, shoulders, and start/select buttons appear once the emulator session is ready.
3. Tap/press and hold each button. EmulatorJS should receive the mapped virtual key events (`Arrow` keys, `Z`/`X`, `A`/`S`, `Q`/`W`, `Enter`, `Shift`).
4. Dragging away from a button should still release the key because pointer capture is enabled.
5. Toggle `NEXT_PUBLIC_ENABLE_TOUCH_OVERLAY=false` to verify the overlay can be disabled for keyboard/mouse QA.
