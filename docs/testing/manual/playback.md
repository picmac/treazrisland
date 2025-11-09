# Manual QA – Emulator Playback

This checklist verifies that in-browser EmulatorJS playback flows remain healthy after changes to the player stack.

## Prerequisites
- Backend (`backend/`) and frontend (`frontend/`) dev servers are running with the same environment as production.
- A test account with at least one ROM in the library and permission to launch `/play` routes.
- Browser cache cleared or private window to avoid stale EmulatorJS bundles.

## Save State Creation
1. Navigate to `/play?romId=<known-rom-id>` and confirm the ROM metadata header renders with the expected title and platform slug.
2. Let the ROM boot, then trigger an in-game save action (e.g., pause menu) or use the EmulatorJS hotkey (`Shift+F5`) to create a save state.
3. Verify a success toast or status indicator appears inside the emulator frame (if applicable) and no errors are logged in the browser console.
4. Inspect the network tab for a `POST /play-states` call that returns `201`.

## Resume From Latest State
1. Reload the `/play?romId=<same-rom-id>` page.
2. Confirm the emulator automatically loads the most recent play state (the game should resume near the point saved above).
3. If auto-load fails, open the EmulatorJS menu and manually load the latest slot; ensure playback resumes without errors.
4. Check the browser console for any warnings about signed URLs or storage failures.

## Recent Play Listings
1. Visit the dashboard or component that lists recent play activity (e.g., `/dashboard`).
2. Confirm the ROM played above appears with the correct cover art, platform label, and timestamp.
3. Follow the “Resume” or equivalent link to ensure it routes back to `/play?romId=…` and boots without prompting for missing assets.

## Cleanup
- Optionally delete the created play state via the backend admin tools or API to keep test storage tidy.
- Restore any modified feature flags or environment variables.
