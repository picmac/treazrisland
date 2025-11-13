# Security Review Checklist

This checklist is used for release readiness and must be acknowledged on every pull request that can impact the security posture of Treazrisland. Add the `security-checklist:acknowledged` label to the PR or trigger the comment bot to respond with `Security checklist acknowledged` so that the CI gate can proceed.

## Authentication & Authorization
- [ ] Document what auth surfaces the change touches (frontend login flows, backend session middleware, etc.).
- [ ] Verify OAuth/OpenID flows do not expose client secrets or redirect users to untrusted origins.
- [ ] Ensure tokens/cookies are `HttpOnly`, `Secure`, and have appropriate lifetimes and scopes.
- [ ] Confirm role- or feature-based access controls are enforced server-side (never rely solely on UI gating).
- [ ] Validate that rate-limiting or captcha protections are in place on sensitive auth endpoints.

## Secrets Management
- [ ] All new secrets are referenced via environment variables or secret managers—never committed to the repo.
- [ ] Rotate or invalidate secrets when rotating infrastructure (DBs, third-party integrations, etc.).
- [ ] Update `README`/runbooks when new secrets are introduced so operators can configure them safely.
- [ ] Use distinct secrets per environment (development, staging, production) and enforce least privilege.
- [ ] Audit logging is enabled for access to secret managers or vaults involved in the change.

## Dependency Security
- [ ] Record any new runtime dependency and justify why it is needed; prefer audited, maintained packages.
- [ ] Check for known vulnerabilities with `pnpm audit --recursive --prod` (runs automatically in CI, but confirm locally when iterating on package changes).
- [ ] If your organization uses Snyk, verify the `SNYK_TOKEN` secret is configured so CI can run enhanced scans.
- [ ] Remove unused packages and lock file changes that are unrelated to the feature.
- [ ] Ensure transitive dependency updates do not lower the overall security posture (e.g., avoid downgrading patched libraries).

## Rollout Notes
- [ ] List any migration or rollback steps required if a security regression is discovered.
- [ ] Capture open questions or follow-ups in the PR description.
- [ ] Link to this checklist in the PR description to remind reviewers of the gating requirement.
