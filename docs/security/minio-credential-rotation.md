# MinIO Uploader Credential & Policy Rotation

The `treaz-uploader` service account powers ROM and asset uploads. Rotate its
credentials and validate the scoped policy whenever MinIO access keys are
renewed or storage policies change.

## 1. Prepare the new access key

1. Log into the MinIO admin console or use `mc admin user add` to create a new
   access key/secret pair.
2. Attach the `treaz-uploader` policy defined in
   `infra/minio/policies/treaz-uploader.json`. This policy now enforces:
   - Server-side encryption (`x-amz-server-side-encryption=AES256`) on every
     upload.
   - Write-only access to `treaz-roms/uploads/` and `treaz-assets/uploads/`.
   - Permission to ship audit events into `treaz-audit/upload-events/` so
     MinIO bucket logging stays healthy.
3. Run `mc admin policy info treaz treaz-uploader` to confirm there is no drift.

## 2. Update secret stores

1. In the secret manager (Vault, Doppler, GitHub Actions, etc.) replace
   `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY` with the newly issued pair.
2. If you pin credentials inside the Docker Compose `.env`, refresh the values
   there as well. Keep the old pair available until rollout validation completes
   so you can roll back quickly if needed.

## 3. Deploy and verify

1. Redeploy the backend so the updated credentials are loaded.
2. Run the smoke upload script or manually upload a small ROM/asset to confirm
   PUT requests succeed and are transparently encrypted. When using `mc stat`
   the resulting objects should report `SSE-S3: true`.
3. Check the `treaz-audit` bucket for a fresh object under
   `upload-events/`—MinIO writes one whenever a multipart upload completes. If
   nothing appears, review the MinIO server audit configuration.
4. Review backend logs for `player.ws_rejected` or `storage_write_failed`
   warnings that could indicate policy enforcement issues.

## 4. Revoke the old key

Once uploads succeed end-to-end:

1. Remove the previous access key/secret from the secret manager and
   configuration files.
2. Disable the old key in MinIO (`mc admin user disable treaz <old-access-key>`)
   and delete it after a short observation period.
3. Archive the rotation timestamp and the new key identifier in the security
   runbook for audit traceability.
