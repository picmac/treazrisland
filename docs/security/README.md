# Security Documentation

Central hub for TREAZRISLAND security requirements, architecture notes, and operational checklists.

## Contents

| File | Purpose |
| ---- | ------- |
| [`threat-model.md`](./threat-model.md) | Enumerates assets, trust boundaries, and mitigation strategies. Review before introducing new integrations or changing auth flows. |
| [`hardening-checklist.md`](./hardening-checklist.md) | Step-by-step deployment checklist covering headers, TLS, storage encryption, backups, and monitoring. |
| [`incident-response.md`](./incident-response.md) *(if present)* | Workflow for triaging and communicating security incidents. |

Always cross-reference the [Coding Agents Playbook](../../AGENTS.md) and [`TREAZRISLAND_PRD.md`](../../TREAZRISLAND_PRD.md) to ensure new work aligns with the baseline requirements.

## Operational expectations

- Populate environment secrets following `.env.example` and rotate them as described in the hardening checklist.
- Enable metrics (`METRICS_ENABLED=true`) and forward Pino logs to your SIEM with a 30-day retention minimum.
- Apply the latest Prisma migrations before exposing new builds to production to avoid schema drift.

Document deviations from the hardening checklist in your deployment runbook and create follow-up issues to close any gaps.
