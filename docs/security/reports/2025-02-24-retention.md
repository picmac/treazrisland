# Upload Retention Policy – 2025-02-24

## Scope
- `rom_upload_audit` table in PostgreSQL.
- MinIO object prefixes `treaz-roms/uploads/` and `treaz-assets/uploads/`.

## Actions
1. Added `backend/scripts/retention/prune-rom-upload-audit.ts` to remove audit rows older than 90 days and delete associated storage objects (invoked via `npm run retention:prune`).
2. Created MinIO lifecycle definition `infra/minio/lifecycle/uploads-retention.json` to expire `/uploads/` objects after 90 days.
3. Documented manual execution notes here and linked them from the hardening checklist.

## Validation
- Manual execution plan: export `DATABASE_URL` and run `npm run retention:prune` during maintenance windows; the script deletes storage objects before removing database rows.
- Lifecycle JSON validated with `mc ilm rule import` (dry-run) to confirm MinIO accepts the structure.

## Follow-ups
- Schedule the pruning script via cron or GitHub Actions with a staging dry run before production execution.
- Automate application of the MinIO lifecycle rule during provisioning to avoid manual drift.
