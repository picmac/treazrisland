# Launch Logbook

This log captures every meaningful build drop, playtest, and approval milestone for Treazr Island. Each entry must link to artefacts stored inside [`docs/logbook/artifacts/`](./artifacts/) such as screenshots, screen recordings, or decision documents. Use the automation script at `scripts/logbook/add_entry.ts` to keep formatting consistent.

## Entry Format

Entries are appended chronologically and use the following structure:

```
## <ISO timestamp> — <Build|Playtest|Approval> — <Title>

- **Summary:** Why the event matters and what changed.
- **Artifacts:**
  - [artifact-name.ext](artifacts/artifact-name.ext)
- **Notes:** (Optional extra color such as blockers, sign-offs, or next steps.)
```

## Automation

Run the helper script to create new entries:

```bash
pnpm ts-node scripts/logbook/add_entry.ts \
  --type build \
  --title "Alpha 2 build" \
  --summary "Stabilised combat loop and enabled SFX" \
  --artifacts "alpha2-hud.png,alpha2-demo.mp4" \
  --notes "Ready for QA dry run"
```

The script validates that every referenced artifact already lives inside [`docs/logbook/artifacts/`](./artifacts/). Add any new screenshots or recordings to that folder (git-tracked, no binaries larger than repo policy) before logging the entry.

## Entries

### 2024-07-05T00:00:00Z — Build — Logbook Automation Baseline

- **Summary:** Established the launch logbook, artifacts folder, and CLI automation for appending future entries.
- **Artifacts:**
  - [logbook-setup.md](artifacts/logbook-setup.md)
- **Notes:** Serves as the initial reference for the documentation workflow.
