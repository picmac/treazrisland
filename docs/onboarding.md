# Admin onboarding wizard

The `/onboarding` route guides the first operator through a predictable four-step flow that mirrors the
bootstrap story from the PRD. Each panel is interactive and persists progress to both `localStorage`
and `sessionStorage`, so a browser refresh or crash will not reset the checklist.

![Onboarding wizard screenshot](browser:/invocations/rgahseba/artifacts/artifacts/onboarding-wizard.png)

## Flow overview

| Step                             | Purpose                                                                                                                                              | API touchpoints                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1. Verify backend health         | Pings `/health` to confirm Redis and object storage are reachable before doing privileged work.                                                      | `GET /health`                                              |
| 2. Verify admin profile          | Loads the authenticated user via `GET /auth/profile`, lets the operator edit the display name, and saves via `PATCH /auth/profile`.                  | `GET /auth/profile`, `PATCH /auth/profile`                 |
| 3. Configure EmulatorJS endpoint | Reads the last embed URL from `GET /admin/emulator-config`, validates the provided URL server-side, and stores it with `PUT /admin/emulator-config`. | `GET /admin/emulator-config`, `PUT /admin/emulator-config` |
| 4. Upload first ROM              | Uses the shared `useRomUpload` hook to calculate the checksum, base64-encode the file, and call `POST /admin/roms`.                                  | `POST /admin/roms`                                         |

### Storage & resumability

- Progress is stored under the `treazr.adminOnboarding.v1` key in both `localStorage` and
  `sessionStorage`. When the page mounts, it hydrates from whichever store has data.
- Each step captures the payload returned by the backend (e.g., the ROM ID or emulator
  configuration timestamp) so the hero card can display “Last updated” metadata.
- Completed steps stay available: the navigation list enables jumping back to earlier panels once
  the prerequisite steps are complete.

### Hook reuse

The ROM step relies on `frontend/src/hooks/useRomUpload.ts`, which centralises the browser file
handling logic:

1. Reads the selected `File` as an `ArrayBuffer`.
2. Uses Web Crypto to calculate the SHA-256 checksum expected by `/admin/roms`.
3. Converts the payload to base64 and submits it via the new `registerAdminRom` helper in
   `frontend/src/lib/admin.ts`.

Any future uploader (e.g., a dedicated admin dashboard) can import the same hook for consistent
validation and error handling.

### EmulatorJS configuration

The backend now exposes `/admin/emulator-config`, which stores the embed URL in Redis after verifying
that the endpoint responds to a `HEAD` (or fallback `GET`) request within five seconds. The wizard’s
third step consumes this API, so operators can self-service their EmulatorJS host without touching
`.env` files.

### Extending the flow

- Add another step by updating `wizardSteps` inside `frontend/src/app/onboarding/page.tsx` and
  creating a matching component in `frontend/src/app/onboarding/steps/`.
- The doc-blocked `StepDataMap` type in `frontend/src/app/onboarding/types.ts` ensures the progress
  payload is serialised consistently when new steps are added.
