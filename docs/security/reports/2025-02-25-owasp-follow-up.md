# OWASP & Platform Security Review Follow-Up — 2025-02-25

## Scope & Context
- Performed a consolidated review of backend (Fastify/Prisma), frontend (Next.js), and Docker-based service definitions.
- Focused on OWASP Top 10 controls, storage isolation, CSP enforcement, CSRF posture, and container supply chain freshness.
- Prior investigations covered PostgreSQL, MinIO, and first-party app images; this follow-up packages remediation work for the development environment (no downstream notifications required).

## Key Findings (Recap)
1. **Filesystem Storage Path Traversal Exposure** — `StorageService` allows crafted keys to escape the configured storage root when using the filesystem driver.
2. **Content Security Policy Weaknesses** — `script-src` falls back to `'unsafe-inline'` when nonces are absent, and `connect-src` always permits `http:` alongside `https:`.
3. **Session Refresh CSRF Window** — Refresh cookie relies on `SameSite=Lax` without an additional token or stricter cookie mode.
4. **Plain-HTTP Requirement** — Air-gapped LAN operation must remain possible without TLS; current tooling supports this but needs a guardrail so future changes do not regress it.
5. **Container & Dependency Currency** — PostgreSQL floats on `16-alpine`, MinIO server/client lag behind upstream security releases, and Node images still use the older Debian Bullseye base.

## Remediation Packages

### Package A — Storage & Session Hardening
- Guard filesystem storage paths using `path.resolve` and prefix checks before read/write/delete operations.
- Add regression tests covering malicious keys (e.g., `../../etc/passwd`) to ensure enforcement sticks.
- Tighten refresh-token defenses by either setting the cookie to `SameSite=Strict` or introducing a double-submit/anti-CSRF token validated on refresh/logout endpoints.
- Document the new storage guard and CSRF expectations in `docs/security/hardening-checklist.md`.

### Package B — CSP & HTTP Mode Governance
- Extend nonce injection (or hashed inline scripts) to all rendered pages so `script-src` never reverts to `'unsafe-inline'`.
- Make `connect-src` conditionally include `http:` only when `TREAZ_TLS_MODE=http`; enforce `https:` only in TLS mode.
- Add automated linting or integration tests that fail when CSP headers miss required nonces in HTTPS mode.
- Capture the HTTP/TLS decision matrix in deployment docs, flagging the air-gapped requirement so reviewers keep plain-HTTP support intact.

### Package C — Container Currency & Supply Chain Hygiene
- Pin PostgreSQL to a recent patch release (e.g., `postgres:16.10-alpine3.22`) and schedule monthly checks for upstream advisories.
- Upgrade MinIO server and `mc` client to the latest security release pair, verifying bootstrap compatibility.
- Move Node-based images to the latest supported LTS base (currently `node:22-bookworm` until the official `node:24-bookworm` image ships) and confirm the build pipeline still passes.
- Record target versions and update cadence in `ops/` or `infra/` docs to keep the stack reproducible.

## Next Steps
- Tackle packages in priority order (A → B → C) or bundle into a sprint depending on engineering bandwidth.
- No external communication is required for these development-environment remediations; track progress in the security backlog.
