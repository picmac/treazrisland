# Upgrade Guide

This guide explains how to safely upgrade Treazrisland deployments, including database migrations, asset refreshes, and configuration updates. Follow every step in order and document any deviations in your deployment log.

## 1. Preparation

1. **Review release notes:** Confirm the release version, its semver impact (major/minor/patch), and any breaking changes.
2. **Freeze deployments:** Pause other CI/CD pipelines or cron jobs that could modify the environment during the upgrade.
3. **Validate access:** Ensure you have credentials for the application servers, database, object storage (for assets), and the configuration secret store.
4. **Capture current state:**
   - Record running application version (`git rev-parse HEAD` or container tag).
   - Export environment variables or configuration files (`/etc/treazrisland/*.env`).
   - Note the current database schema version from the migrations table.

## 2. Backups

1. **Database snapshot:**
   - For PostgreSQL: `pg_dump --format=custom --file=backup_<timestamp>.dump $DATABASE_URL`.
   - Store the dump in encrypted storage with a retention policy that matches compliance requirements.
2. **Asset archive:**
   - Sync the asset bucket or directory (e.g., `aws s3 sync s3://treazrisland-assets ./asset-backup_<timestamp>`).
3. **Configuration bundle:**
   - Export secrets or config maps into a secure location (e.g., `kubectl get secret treazrisland-config -o yaml > config_backup_<timestamp>.yaml`).
4. **Integrity checks:**
   - Verify backup files with checksums (`sha256sum`).

## 3. Database Migrations

1. **Dry run locally:** Execute migrations in a staging environment first (`pnpm backend db:migrate`).
2. **Apply migrations in production:**
   - Put the app into maintenance mode if supported.
   - Run the migration command (e.g., `pnpm backend db:migrate`).
   - Monitor logs for errors and confirm the schema version increments.
3. **Post-migration validation:**
   - Run smoke tests or read-only queries to confirm critical tables and indexes exist.
   - If the release adds data backfills, confirm background jobs complete successfully.

## 4. Asset Updates

1. **Build artifacts:** Generate the frontend bundle (`pnpm --filter frontend build`) and any image/audio packs.
2. **Upload assets:**
   - Use `aws s3 sync dist/ s3://treazrisland-assets --delete` or the equivalent for your storage provider.
   - Purge CDN caches if applicable.
3. **Verify integrity:** Spot-check a few files by downloading them from the CDN/storage and comparing checksums to the local build.

## 5. Configuration Changes

1. **Diff configs:** Compare the new sample `.env` or Helm values file with the existing deployment.
2. **Apply updates:**
   - Add new keys with documented defaults.
   - Remove deprecated keys only after the application no longer references them.
3. **Secret rotation:** If the upgrade requires rotating secrets, perform the rotation before deploying the new code to avoid downtime.
4. **Validation:** Restart services with the updated configuration and watch logs for missing variables or schema mismatches.

## 6. Deployment

1. Deploy the application code (containers, serverless functions, or bare metal) referencing the new version tag.
2. Gradually shift traffic (blue/green or canary) while monitoring metrics (latency, error rates, database load).
3. When stable, remove maintenance mode and announce completion.

## 7. Rollback & Restoration

If issues arise, execute the rollback procedure immediately.

1. **Application code:** Redeploy the previous known-good version tag. For containerized deployments, redeploy the last stable image digest.
2. **Database schema:**
   - Run the down migrations corresponding to the release (e.g., `pnpm backend db:migrate --direction down --to <previous_version>`).
   - If down migrations are unavailable or risky, restore the database backup (see below).
3. **Assets:** Resync the saved asset archive back to the storage bucket (`aws s3 sync ./asset-backup_<timestamp> s3://treazrisland-assets --delete`).
4. **Configuration:** Reapply the configuration bundle captured earlier, either by reloading the secret/config map or restoring the `.env` files from backup.
5. **Verification:** Confirm the application reports the previous version and that health checks pass.

### Database Backup Restoration

1. Stop application traffic to prevent writes.
2. Drop or rename the affected database to avoid partial data conflicts.
3. Restore from backup:
   - PostgreSQL example: `pg_restore --clean --if-exists --dbname=$DATABASE_URL backup_<timestamp>.dump`.
4. Re-run migrations up to the desired schema version.
5. Re-enable traffic and monitor closely.

## 8. Post-Upgrade Checklist

- [ ] Backups stored and verified.
- [ ] Database migrations applied and validated.
- [ ] Assets updated and CDN caches warmed.
- [ ] Configuration changes documented.
- [ ] Monitoring and alerting show normal baselines.
- [ ] Rollback plan remains current for the next release.

Document any anomalies or lessons learned in the runbook for future upgrades.
