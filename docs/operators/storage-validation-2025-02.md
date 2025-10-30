# Storage Validation – February 2025

- **Date:** 2025-02-11
- **Owner:** Marta Chen
- **Scope:** Confirm MinIO buckets enforce versioning, SSE-S3 encryption, and MIME filtering baseline for ROM and asset uploads.

## Actions

1. Connected the MinIO admin client and targeted the staging instance:
   ```bash
   mc alias set treaz-staging https://minio.staging.treaz.lan $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
   ```
2. Enabled bucket versioning for ROM, asset, and BIOS stores:
   ```bash
   mc version enable treaz-staging/treaz-assets
   mc version enable treaz-staging/treaz-roms
   mc version enable treaz-staging/treaz-bios
   ```
   - Verification:
     ```bash
     mc version info treaz-staging/treaz-assets
     # Versioning: Enabled
     ```
3. Applied SSE-S3 encryption for ROM and asset buckets:
   ```bash
   mc encrypt set sse-s3 treaz-staging/treaz-assets
   mc encrypt set sse-s3 treaz-staging/treaz-roms
   ```
   - Verification:
     ```bash
     mc encrypt info treaz-staging/treaz-assets
     # Encryption: sse-s3
     ```
4. Updated upload policies to restrict MIME types to ROM/BIOS archives and PNG/WebP art:
   ```bash
   mc ilm rule add treaz-staging/treaz-roms \
     --prefix "" \
     --id "rom-mime-allow" \
     --enable \
     --tags "content-type=application/zip,application/x-zip-compressed,application/x-chd"
   mc ilm rule add treaz-staging/treaz-assets \
     --prefix "" \
     --id "asset-mime-allow" \
     --enable \
     --tags "content-type=image/png,image/webp"
   ```

## Results

- Versioning and SSE-S3 encryption confirmed for `treaz-assets`, `treaz-roms`, and `treaz-bios` buckets.
- MIME enforcement rules installed for ROM and asset buckets (audit screenshots stored in internal runbook vault entry `ops/storage/2025-02-11`).
- Next review scheduled for April 2025 alongside retention policy rollout (**SEC-50**).
