# Treazr Island Playtest Script

This script guides internal testers through the entire MVP flow—from admin setup to resuming from a save-state—so we capture consistent feedback before inviting external players.

## Roles

- **Admin Facilitator**: Seeds accounts/content, configures feature flags, unlocks builds for testers.
- **Session Lead**: Walks testers through the script, timeboxes phases, and ensures logs are captured.
- **Observer / Note-taker**: Fills in the observation log template and confirms issues are filed.
- **Testers**: Follow prompts, narrate their thoughts, and attempt each required task.

## Pre-session Checklist (T-24h)

1. Confirm staging backend and frontend deployments are healthy (run `pnpm dev:status` or review deployment dashboards).
2. Ensure admin credentials work and MFA resets are available.
3. Generate four tester accounts (`test01`–`test04`) plus one moderator account; share via the password vault.
4. Draft the cohort description text (≥20 characters) required when creating the `Playtest-<date>` cohort.
5. Load the latest quest data set and reward tables via the admin console import tool.
6. Verify telemetry ingestion and screenshot capture services are running.

## Session Flow

### 1. Admin Console Setup (10 minutes)

1. Admin logs into `https://staging-admin.treazrisland.com`.
2. Navigate to **Experiments → Feature Flags**; ensure `retro_mvp_core` and `save_state_beta` are enabled.
3. In **Players → Cohorts**, create a cohort named `Playtest-<date>` containing the four tester accounts.
4. Open **Quests → Seasonal Playlist** and publish the "Crystal Cavern" questline.
5. Verify telemetry dashboards show the cohort members in the "Ready" state.

### 2. Session Kickoff (5 minutes)

1. Session Lead welcomes testers, states objectives, and reviews etiquette.
2. Distribute observation log template (see below) and confirm screen-recording is active.
3. Ask testers to speak aloud while playing.

### 3. Core Gameplay Tasks (30 minutes)

For each tester, guide through the following beats:

1. Launch game client → log in with assigned credentials.
2. Complete tutorial prompts until the HUD displays the quest tracker.
3. Open the quest log and pin "Crystal Cavern".
4. Acquire the **Signal Scanner** item from the Bazaar.
5. Trigger a random encounter and win at least one turn-based battle.
6. Spend earned credits to repair the **Beacon Array**.
7. Capture at least one screenshot via the in-game share panel.

### 4. Save-State & Resume Validation (15 minutes)

1. Ask testers to pause at the quest checkpoint and use **Menu → Save & Suspend**.
2. Confirm the save confirmation modal lists the timestamp and quest progress.
3. Close the client entirely.
4. Relaunch the client and use **Resume Last Session**.
5. Verify the quest tracker displays the saved checkpoint and the inventory contains the previously collected items.
6. Have testers report any mismatch; Observer logs details and exact timestamps.

### 5. Wrap-up (10 minutes)

1. Collect a quick satisfaction rating (1–5) from each tester.
2. Review open observations, confirm issue IDs, and thank participants.
3. Archive screen recordings and attach links to the observation log.

## Observation Log Template

Copy the table below per tester or checkpoint.

| Timestamp (UTC) | Tester ID | Step / Feature | Observation | Severity (info/min/maj/blocker) | Evidence (link/screenshot) | Filed? (issue #) |
| --------------- | --------- | -------------- | ----------- | ------------------------------- | -------------------------- | ---------------- |
|                 |           |                |             |                                 |                            |                  |

## Issue Reporting Workflow

1. **Draft the issue**: Use the `Playtest Report` issue template in GitHub; include log snippets, screenshots, and reproduction steps.
2. **Tag owners**: Assign to the feature module owner (refer to `docs/dependency-matrix.md`) and mention `@treazrisland/gameplay` for gameplay blockers.
3. **Link evidence**: Attach observation log row links and video segments; store large files in the shared drive under `/Playtests/<date>/` and reference the URL.
4. **Set priority**: Use `P0` for blockers preventing progression, `P1` for major feature gaps, `P2` for polish, `P3` for suggestions.
5. **Confirm triage**: Observer posts a summary in `#mvp-playtest` Slack after filing and marks the observation row as "Filed" with the issue number.

## Communication & Follow-up

- Session Lead circulates a recap email (or Slack summary) within 24 hours, referencing filed issues and action owners.
- Product owner reviews all `P0/P1` items within 48 hours and schedules hotfix discussions as needed.
- QA lead updates this script whenever new MVP features require coverage.
