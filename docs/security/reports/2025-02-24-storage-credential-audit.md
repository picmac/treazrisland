# Object Storage Credential Audit – 2025-02-24

## Scope
- Service account used by the upload pipeline (`treaz-uploader`).
- MinIO policy definitions deployed alongside the Docker Compose stack.
- Secret storage for `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.

## Findings
- Confirmed the dedicated uploader policy (`infra/minio/policies/treaz-uploader.json`) allows only `s3:GetObject`, `s3:PutObject`, multipart helpers, and restricted `ListBucket` operations scoped to the `/uploads/` prefixes.
- Reviewed the documented Vault path `secret/data/treaz/prod/storage#TREAZ_UPLOADER_*` to confirm the scoped service account remains isolated from MinIO root access (read-only review; no secrets committed).
- Ensured the backend Compose manifests reference the scoped credentials rather than MinIO root keys.

## Actions
1. Updated the policy artifact checked into version control for repeatable provisioning.
2. Cross-checked the Vault path to ensure the service account aligns with the restricted policy.
3. Documented rotation procedure in this report and linked it from the hardening checklist.

## Follow-ups
- Automate a weekly `mc admin user info treaz-uploader` check that fails CI when the policy drifts or extra permissions are granted.
