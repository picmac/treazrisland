# QA Baseline Gallery

These placeholders describe the four smoke-test flows. Replace each SVG with a real screenshot or short clip captured from staging before a release.

| Flow           | File                        | Notes                                                              |
| -------------- | --------------------------- | ------------------------------------------------------------------ |
| Onboarding     | `onboarding-baseline.svg`   | Capture after the first-admin form renders with valid values.      |
| Login (MFA)    | `login-baseline.svg`        | Show the MFA challenge banner plus credential fields.              |
| Library Browse | `library-baseline.svg`      | Include the filter bar and at least one platform tile.             |
| Admin Upload   | `admin-upload-baseline.svg` | Highlight the dropzone with one queued file and platform selector. |

Export real captures at 1280×720 (PNG preferred) and commit them over the SVGs to keep regression history in Git.
