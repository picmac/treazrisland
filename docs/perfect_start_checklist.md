# Perfect Start Launch Readiness Checklist

## Overview

This checklist guarantees a flawless first impression when unveiling Treazrisland and maps directly to the [MVP release criteria](./mvp_scope.md#release-criteria). Complete every item before inviting the first external playtester. Track status in your project management tool and link supporting evidence (screenshots, logs, sign-off notes).

## Timeline

- **T-14 days:** Bootstrap infrastructure, confirm Pixellab.ai access, schedule rehearsals.
- **T-7 days:** Finish feature freeze, run full regression testing, lock documentation versions.
- **T-3 days:** Conduct rehearsal play session, finalise release notes, prep comms.
- **Launch Day:** Execute go/no-go call, perform final smoke tests, start monitoring.
- **T+1 day:** Review metrics, collect feedback, and update retrospective log.

## Readiness Dimensions

### 1. Infrastructure & Tooling

- [ ] `./scripts/bootstrap.sh` validated on macOS (Intel + Apple Silicon) and Linux (Ubuntu LTS) hosts.
- [ ] Docker Compose stack passes health checks within target boot window (<5 minutes) on reference hardware.
- [ ] Local runner profile verified to auto-launch EmulatorJS with seeded ROM after bootstrap.
- [ ] Backups configured for PostgreSQL and object storage volumes; restoration test documented.
- [ ] Monitoring dashboard (logs, metrics) bookmarked and shared with the team.
- [ ] [Dependency matrix](./dependency-matrix.md) reviewed to confirm every container, runtime, and database is on the most recent LTS release.

### 2. Pixellab.ai Theming

- [ ] Pixellab.ai API token stored securely with the storage location documented for operators.
- [ ] Prompt catalogue reviewed; unused prompts archived, final set approved.
- [ ] Asset manifest generated with accessibility audit results appended.
- [ ] EmulatorJS play route visually checked against ROMM reference screenshots on desktop and mobile widths.
- [ ] Art QA script executed; findings logged in launch logbook.

### 3. Security & Compliance

- [ ] [Security review checklist](./security/review-checklist.md) completed for all merged changes (dependency review, input validation, logging hygiene).
- [ ] Static analysis (e.g., `pnpm lint`, `pnpm typecheck`, `pnpm audit --production`) executed and green.
- [ ] Pen-test or threat modelling session completed; action items tracked.
- [ ] Secrets inventory documented with rotation cadence.
- [ ] Incident response playbook rehearsed with at least one simulated outage.
- [ ] Code style automation (Prettier, ESLint, Prisma format) confirmed as blocking checks in CI and run locally before release.

### 4. Quality Assurance

- [ ] Automated test suite (unit, integration, Playwright smoke) passes in CI and locally.
- [ ] Visual regression suite reviewed; any diffs signed off by design.
- [ ] Manual exploratory checklist executed on desktop, tablet, and mobile breakpoints.
- [ ] Localization strings proofread (even if English-only) to catch typos and tone issues.
- [ ] Performance smoke test run (library load under 2 seconds for seeded data set).
- [ ] Release notes document the validated LTS versions so future upgrades have a clear baseline.

### 5. Documentation & Communication

- [ ] README and installation guide updated with latest commands and troubleshooting tips.
- [ ] Ops runbook (including rollback steps) peer-reviewed and stored in shared drive.
- [ ] Changelog entry drafted with highlight reel and known limitations.
- [ ] Support contact matrix published (engineering, design, operations).
- [ ] Launch announcement copy approved (email, social, community post templates).

### 6. Governance & Sign-off

- [ ] Go/no-go meeting held with minutes recorded.
- [ ] Product owner sign-off recorded for UX, theming, and copy.
- [ ] Security reviewer sign-off recorded post-checklist review.
- [ ] QA lead sign-off recorded post-test execution.
- [ ] Retrospective scheduled for T+2 days with agenda drafted.

### 7. Manual Playtest & Documentation Updates

- [ ] End-to-end manual playtest executed according to the [MVP release criteria scenario](./mvp_scope.md#release-criteria), covering admin provisioning through save-state validation.
- [ ] Playtest findings logged with sign-off notes from QA, product, and operations leads, and stored alongside other launch artefacts.
- [ ] Resulting documentation updates (README, installation guide, runbooks) filed and merged so the published guidance reflects the validated flow.
- [ ] Links to evidence (screenshots, recordings, telemetry) captured in the project tracker for quick audit.

## Post-Launch Follow-up

- [ ] Capture telemetry snapshots (usage, errors) at T+1h, T+6h, and T+24h.
- [ ] Collect user feedback via survey/interview template; log insights in product backlog.
- [ ] Update backlog with Cloudflare integration tasks and prioritise for next sprint.
- [ ] Archive launch artefacts (recordings, screenshots, docs) in shared repository.
- [ ] Publish retrospective outcomes and feed action items into the roadmap.
