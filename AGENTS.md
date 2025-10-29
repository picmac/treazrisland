# Coding Agents Playbook – TREAZRISLAND

This document guides autonomous or semi-autonomous coding agents who contribute to TREAZRISLAND. The goal is to ensure consistent delivery, protect project quality, and maintain the 16-bit, Monkey Island–inspired brand vision powered by the PixelLab.ai pipeline.

## 1. Mission & Guiding Principles
- **Protect the product vision:** All changes should reinforce TREAZRISLAND’s SNES aesthetic, privacy-first posture, and self-hosted gaming experience.
- **Prioritise safety and integrity:** Never leak secrets, never commit insecure defaults, and always respect existing rate limits, auth guards, and storage constraints.
- **Operate transparently:** Record reasoning in PR descriptions, reference relevant docs (`docs/TREAZRISLAND_PRD.md`, `docs/security/threat-model.md`), and surface trade-offs.
- **Fail gracefully:** If a task cannot be completed safely (e.g., missing credentials, API limits), return a clear explanation and propose next steps.

## 2. Task Intake Checklist
1. **Clarify scope:** Confirm target module, acceptance criteria, and whether PixelLab assets or backend integrations are in play.
2. **Review relevant docs:**
   - Product context: `docs/TREAZRISLAND_PRD.md`
   - API references: `docs/API_AUTH.md`, `docs/API_LIBRARY.md`, `docs/API_PLAYER.md`
   - Security posture: `docs/security/threat-model.md`, `docs/security/hardening-checklist.md`
   - Testing guidance: `docs/testing/e2e.md`
3. **Assess dependencies:** Identify required environment variables (`.env.example`), Docker services, or external APIs (ScreenScraper, PixelLab.ai).
4. **Plan execution:** Break the task into steps, including tests and validation.

## 3. Coding Standards & Patterns
- **Backend (Fastify + Prisma):**
  - Use TypeScript strict types; avoid `any`.
  - Follow existing route structure (`src/routes/*`) and util modules.
  - Validate inputs with `zod`; enforce auth via `requireRole`.
  - Wrap database mutations in Prisma transactions when multiple tables are touched.
- **Frontend (Next.js + React 19):**
  - Prefer server components unless client interactivity is required.
  - Use existing hooks (`lib/api`, `useFavorites`, `useRomList`) before building new ones.
  - Keep SNES/Monkey Island visual language consistent (pixel fonts, color tokens, pixel-frame components).
  - When generating new art, use the PixelLab client (see Section 5).
- **Styling & Assets:**
  - Respect Tailwind classes and custom pixel components (`PixelButton`, `PixelFrame`).
  - Maintain asset naming conventions and store generated art in object storage via the PixelLab service.

## 4. Security & Compliance Guardrails
- **Secrets:** Never log or commit real credentials. Use environment variables and reference `.env.example` for placeholders.
- **Authentication:** All new endpoints must integrate with Fastify JWT hook. Admin-only actions must require `requireRole("ADMIN")`.
- **Rate limiting:** Follow existing patterns (`config: { rateLimit: { ... } }`), especially for APIs ingesting external data.
- **Data validation:** Sanitize user input, enforce length/format constraints, and avoid storing sensitive data in plaintext.
- **Observability:** Add structured log entries for significant actions (uploads, enrichment, PixelLab requests) without leaking personal data.

## 5. PixelLab.ai Integration Guidelines
- **Client usage:** Interact through the upcoming `PixelLabService`. Configure via `PIXELLAB_API_KEY`, `PIXELLAB_STYLE_ID`, and optional `PIXELLAB_BASE_URL`.
- **Prompt discipline:** Reference the SNES/Monkey Island art direction, specifying palette, lighting, and nostalgic atmosphere. Example prompt snippet:
  > “Create a 16-bit SNES scene reminiscent of Monkey Island, featuring a pirate cove at dusk with warm lantern light and teal ocean tones.”
- **Asset storage:** Save generated assets via `storage.putObject`, tagging metadata with prompt, render version, and style ID. Avoid local /tmp artefacts after upload.
- **Caching:** Reuse existing art when possible. Include cache keys in metadata to prevent redundant PixelLab requests.
- **Error handling:** Respect API rate limits, implement exponential backoff, and surface actionable errors to admins.

## 6. Testing Expectations
- **Backend:** Run `npm test` inside `backend/` when routes, services, or Prisma schema change. Add Vitest specs for new logic or regression coverage.
- **Frontend:** Run `npm test` (Vitest) for component or hook changes. Update Playwright smoke tests if auth flows or routing change.
- **Manual verification:** For pixel art features, capture before/after references or mocked responses to confirm UI integration.
- **CI readiness:** Ensure linting (`npm run lint`, `npm run lint:pixel`) passes before marking work complete.

## 7. Submission Checklist
- [ ] Code adheres to project conventions (TypeScript strictness, Tailwind classes, structured logging).
- [ ] Security impact assessed; no secrets or unsafe defaults introduced.
- [ ] Relevant tests added/updated and executed locally.
- [ ] Documentation updated if new APIs, env vars (e.g., PixelLab), or workflows were introduced.
- [ ] PR description includes:
  - Summary of changes.
  - Testing evidence (unit/e2e/manual).
  - References to requirements (e.g., PRD sections, tickets).
  - Notes on PixelLab usage (style ID, prompt, caching strategy) if applicable.

## 8. Escalation & Support
- **Blocking issues:** Raise a GitHub discussion or notify maintainers with logs, stack traces, or API error payloads.
- **Security concerns:** Immediately flag in the Security Slack channel (or equivalent) and document in the incident log.
- **PixelLab outages:** Switch to cached assets, disable generation features temporarily, and create a follow-up issue to restore functionality.

---

Coding agents help TREAZRISLAND stay vibrant, secure, and delightful. Follow this playbook to deliver features that feel at home on an SNES cartridge and keep our pirate island thriving. Sail smart!***
