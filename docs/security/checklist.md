# Security Checklist

Use this checklist before merging security-impacting changes. CI gates (`CI`, `security-ack`, and `security-checklist-ack`) enforce acknowledgement of these items via the linked workflows: [CI](../../.github/workflows/ci.yml), [security-ack](../../.github/workflows/security-ack.yml), and [security-checklist-ack](../../.github/workflows/security-checklist-ack.yml).

## Password and Credential Policies

- [ ] Enforce password length, complexity, and reuse limits at the API boundary; document any deviations for SSO flows.
- [ ] Store passwords using modern, salted hashing (e.g., Argon2id) and never log or return them in responses.
- [ ] Require password resets for compromised accounts and ensure reset tokens are single-use and short-lived.
- [ ] Confirm rate limiting or captcha is enabled on authentication and password reset endpoints to deter brute force attempts.

## JWT and Token Handling

- [ ] Manage signing secrets in secret managers per environment with rotation procedures and no in-repo copies.
- [ ] Issue JWTs with strict audiences, expiry, and refresh limits; avoid embedding sensitive PII in claims.
- [ ] Rotate tokens when key material changes and revoke tokens on user state changes (role updates, password resets, bans).
- [ ] Emit security and audit logs for token issuance, refresh, and validation failures without leaking secrets or claims payloads.

## Dependency and Supply Chain Hygiene

- [ ] Run `pnpm audit --recursive --prod` locally when modifying dependencies and ensure the `CI` workflow passes dependency checks.
- [ ] Track and justify new runtime dependencies; prefer maintained, signed, or integrity-verified packages.
- [ ] Remove unused or downgraded packages that weaken the security posture; commit lockfile updates only when intentional.

## CI, Observability, and Peer Review Gates

- [ ] Confirm the [CI](../../.github/workflows/ci.yml) workflow succeeds, including security checklist acknowledgement enforced by [security-checklist-ack](../../.github/workflows/security-checklist-ack.yml).
- [ ] Ensure [security-ack](../../.github/workflows/security-ack.yml) succeeds when the checklist requires explicit acknowledgement or labelling.
- [ ] Verify rate limiting and security logging remain in place after changes, and document observability dashboards or alerts updated as part of the work.
- [ ] Obtain peer review that explicitly confirms this checklist, and do not bypass gating workflows without security approval.
