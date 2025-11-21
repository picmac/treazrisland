# Operator Runbook

This runbook captures the end-to-end operational flow for bringing up Treazrisland services, provisioning the first admin user, handling ROM assets, and recovering save-state data. It also provides quick troubleshooting references and placeholders for recorded walkthroughs and emulator UX checklists.

## Prerequisites
- Docker or Docker Compose installed and running.
- PNPM and Node matching the repository engine constraints.
- Access to required environment variables (database URL, storage credentials, etc.).

## 1) Bootstrap the stack
Run the bootstrap helper to seed environment defaults, install dependencies, and prepare local tooling.

```bash
./scripts/bootstrap.sh
```

If you are running inside a containerized environment, ensure the script has execute permissions:

```bash
chmod +x scripts/bootstrap.sh && ./scripts/bootstrap.sh
```

The bootstrap script covers package installation and base configuration. Re-run it after pulling significant changes that add new dependencies.

## 2) Apply database migrations (Prisma)
After bootstrapping, run Prisma migrations to align the database schema. Use the backend package scope to avoid installing frontend dependencies for this step.

```bash
pnpm --filter backend prisma migrate deploy
# OR, for iterative development
pnpm --filter backend prisma migrate dev
```

If using Docker for the database service, start it first (see below) before applying migrations.

## 3) Start services with Docker
Bring up the application and supporting services using Docker Compose.

```bash
docker compose up -d
# Follow logs during first boot
docker compose logs -f --tail=200
```

If you need to rebuild images after dependency updates:

```bash
docker compose build --no-cache
```

## 4) Create the first admin user
Once services are running and migrations are applied, create the initial admin account using the backend CLI.

```bash
pnpm cli:create-admin
# Alternatively, run inside the backend workspace explicitly
pnpm --filter backend create-admin
```

Record the generated credentials securely. If SSO is configured, ensure the admin email matches your identity provider.

## 5) Upload ROM assets
ROM uploads can be handled via the API or by placing files directly into the storage bucket configured for ROM ingestion.

### Using the API (preferred)
1. Authenticate as an admin user and obtain an access token.
2. Send the ROM file to the upload endpoint (replace values as needed):

```bash
curl -X POST "https://<host>/api/roms" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/game.rom" \
  -F "platform=<nes|snes|gba|...>" \
  -F "title=My Game"
```

### Using direct storage drop
- Place ROM files in the configured storage bucket/prefix (e.g., `roms/ingest/`).
- Confirm the ingestion worker is running (`docker compose ps`) and tail logs to verify processing:

```bash
docker compose logs -f rom-ingest
```

## 6) Restore save-state backups
To recover user save-states after an incident:

1. Obtain the save-state archive from backups (e.g., object storage snapshot).
2. Restore the archive into the storage location consumed by the emulator service.
3. If metadata is stored in the database, ensure migrations are applied, then run any reconciliation script if available:

```bash
pnpm --filter backend prisma db seed --preview-feature
# or a dedicated reconciler if present
pnpm --filter backend save-state:reconcile
```

4. Restart emulator-facing services to pick up restored files:

```bash
docker compose restart emulator
```

## 7) Operational health checks
- Verify API readiness: `curl -I https://<host>/healthz`
- Confirm frontend reachability: open the site and sign in with the admin account.
- Check background workers: `docker compose ps` and `docker compose logs <service>`

## Troubleshooting
- **Bootstrap issues**: Ensure PNPM version matches `package.json` and rerun `./scripts/bootstrap.sh`.
- **Prisma migration failures**: Verify database connectivity and clean pending migrations if necessary (`pnpm --filter backend prisma migrate resolve --applied <migration>`).
- **Container crashes**: Check recent logs with `docker compose logs -f --tail=200 <service>`; rebuild images if native dependencies changed.
- **ROM ingestion delays**: Confirm storage credentials and that the ingest worker container is healthy.
- **Save-state mismatches**: Re-run the reconcile step and validate file permissions on restored archives.

## Recorded walkthroughs (placeholders)
- Bootstrap and first-admin setup walkthrough: [Link to recording](https://example.com/recordings/bootstrap-first-admin)
- ROM upload and ingestion monitoring walkthrough: [Link to recording](https://example.com/recordings/rom-upload)
- Save-state recovery drill walkthrough: [Link to recording](https://example.com/recordings/save-state-recovery)

## Emulator UX checklist (placeholder)
- [ ] Controller mapping verified for supported platforms — see checklist: [Emulator UX checklist](https://example.com/checklists/emulator-ux)
- [ ] Save/load state hotkeys documented in UI tooltips.
- [ ] On-screen display overlays confirmed for pause/resume and screenshot capture.
- [ ] Network latency indicators visible during online sessions.
