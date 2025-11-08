# Creative Asset Pipeline & Storage Integration

This playbook documents how TREAZRISLAND sources pixel art, connects it to object storage, and equips administrators and frontend engineers with the tooling required to refresh and swap creative assets safely.

## 1. Art sourcing process

### 1.1 Intake sources and guardrails

- **Primary enrichment** uses the ScreenScraper API with the curated filters maintained in `.env.example` (`SCREENSCRAPER_DEFAULT_MEDIA_TYPES`, language and region priority lists). Only assets that match the SNES-inspired palette are accepted.
- **Secondary enrichment** covers manual uploads from the in-house art team or partner studios. Every manual submission must include provenance metadata (artist, license, upstream URL) that is persisted alongside the asset record in Prisma so audit logs remain actionable.
- **Licensing & safety**: Operators confirm that the upstream usage rights permit redistribution and that no banned imagery appears. Any ambiguous license defaults to rejection.

### 1.2 Acquisition workflow

1. A curator from `/admin/creative-assets` kicks off ingestion or schedules a job through `creativeAssetEnrichment.enqueue` (background queue).
2. The backend fetches candidate media, stages files under `./var/storage/tmp`, and writes a queue event with status details (`FETCHED`, `FORMAT_UNSUPPORTED`, `QA_REJECTED`, etc.).
3. Successful assets are normalized to PNG/WebP, downscaled to the 720 px SNES frame width, padded to maintain pixel ratio, and tagged with palette hashes for regression checks.
4. QA validates palette conformity, compression artifacts, and subject framing. Failed items enter the retry state with explicit reason codes.
5. Approved art publishes to the `treaz-assets` bucket under either `art/platform/<slug>/` or `art/rom/<romId>/`. Prisma records store the checksum, platform/ROM mapping, credit information, and the ScreenScraper source ID to support later refreshes.

### 1.3 Rejection handling & overrides

- Rejections move the queue entry to a retryable state (`FETCH_ERROR`, `FORMAT_UNSUPPORTED`, `QA_REJECTED`).
- Operators triage from the admin dashboard: they can retry, blacklist the upstream asset, or override with a curated upload (which requires a second approval before publication).
- All overrides include a note explaining why automated QA was bypassed so later audits can confirm compliance.

## 2. MinIO / S3 credentials and configuration

TREAZRISLAND uses MinIO in local and staging environments and can target any S3-compatible provider in production. Always use least-privilege service accounts dedicated to the creative tooling.

### 2.1 Provision credentials

```bash
# Run from an ops workstation; never commit secrets
mc alias set treaz-admin https://minio.staging.treaz.lan "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc admin user add treaz-admin creative-assets <32-byte-generated-secret>
mc admin policy attach treaz-admin treaz-uploader --user creative-assets
```

- `infra/minio/bootstrap.sh` applies identical policies for local Docker environments. Re-run it when buckets are recreated.
- Root credentials exist solely for bootstrap automation—do not reuse them inside applications or scripts.

### 2.2 Bucket layout & hardening checklist

| Bucket            | Contents                                    | Notes                                      |
|-------------------|---------------------------------------------|--------------------------------------------|
| `treaz-assets`    | Curated hero art, marquees, wheels, box art | Versioning **enabled**; SSE-S3 enforced    |
| `treaz-roms`      | ROM archives                                | Creative tooling has read-only access      |
| `treaz-bios`      | BIOS references                             | Optional in dev; read-only in production   |

- Apply lifecycle policies from `infra/minio/lifecycle/uploads-retention.json` to expire stale staging uploads.
- Public read access is allowed for CDN distribution, but uploads remain private until QA approves them.

### 2.3 Environment variables

Update `.env` (or the deployment secret store) to match `.env.example`. Minimum keys:

| Variable | Purpose |
| --- | --- |
| `STORAGE_DRIVER` (`filesystem` or `s3`) | Selects the backend driver. Dev defaults to `filesystem`. |
| `STORAGE_ENDPOINT` | MinIO or S3 endpoint URL. Required for `s3`. |
| `STORAGE_REGION` | S3 region string (e.g., `us-east-1`). |
| `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | Service-account credentials (e.g., `creative-assets`). |
| `STORAGE_BUCKET_ASSETS`, `STORAGE_BUCKET_ROMS`, `STORAGE_BUCKET_BIOS` | Bucket names referenced by `StorageService`. |
| `STORAGE_FORCE_PATH_STYLE` | Keep `true` for MinIO or any path-style endpoint. Disable only when the provider requires virtual-hosted-style URLs. |
| `STORAGE_SIGNED_URL_TTL` | Optional TTL (e.g., `15m`) for generated signed URLs. |

> ℹ️ `backend/src/config/env.ts` already validates that all required S3 values exist when `STORAGE_DRIVER=s3`. Missing fields cause the process to exit on boot.

### 2.4 Connectivity validation

1. Ensure the environment variables above are exported (or stored in `.env`).
2. Run the storage health probe:

   ```bash
   npm run storage:health --prefix backend
   ```

   The script writes a temporary object to `treaz-assets`, retrieves it to verify signed URL access when applicable, and deletes the object. Failures print actionable guidance.

3. For AWS S3 deployments, set `STORAGE_ENDPOINT=https://s3.<region>.amazonaws.com` and disable `STORAGE_FORCE_PATH_STYLE` only if the account supports virtual-hosted-style buckets.

## 3. Admin tooling requirements

### 3.1 Asset refresh operations

- Provide `POST /admin/assets/:id/refresh` (Fastify route) that enqueues a refresh job with an idempotency key derived from `assetId`, source identifier, and checksum.
- Schedule a nightly worker that scans assets older than 90 days or flagged by QA and re-fetches upstream art. Jobs purge superseded object versions, store the previous version ID for rollbacks, and emit structured logs (`asset_refresh_completed`).
- Expose telemetry in `/admin/creative-assets`: queue depth, next scheduled run, last completion timestamp, and failures grouped by reason.
- Implement a manual rollback endpoint `POST /admin/assets/:id/rollback` that restores the previous version ID recorded during refresh.

### 3.2 Authorization & auditing

- Protect refresh and rollback endpoints with `requireRole("ADMIN")`. Introduce a `CURATOR` role that can queue refreshes but cannot change retention policies.
- UI controls must respect the same permissions—display disabled states with tooltips when the user lacks rights.
- Record every refresh request in `AuditLog` (actor ID, asset ID, action, result, checksum delta). Attach metadata so investigations can trace upstream provenance.
- Ship behind a feature flag `ENABLE_ASSET_REFRESH_UI` (default `false` in production) to stage the rollout safely.

## 4. Frontend coordination & reserved hooks

### 4.1 Shared hook

- Reserve `frontend/src/hooks/useCreativeAssets.ts` exporting:

  ```ts
  interface CreativeAssetRecord {
    id: string;
    romId?: string;
    platformSlug?: string;
    currentAssetUrl: string;
    pendingAssetUrl?: string;
    refreshState: "idle" | "refreshing" | "error";
  }

  export function useCreativeAssets() {
    // TODO: wire to creative-asset admin endpoints once they land.
    // Should expose list + refresh/rollback mutations with optimistic updates.
  }
  ```

- The hook should wrap `lib/api` clients so both admin and library surfaces consume the same cache.

### 4.2 Admin UI wiring

- `frontend/src/admin/creative-assets/CreativeAssetManager.tsx` consumes the hook, rendering refresh CTAs, rollback menus, and pixel-frame status badges (`idle`, `refreshing`, `error`).
- Reserve data attributes (`data-asset-refresh`, `data-asset-rollback`) to enable QA automation and visual regression testing.
- Emit analytics via the telemetry context (`creative_asset.refresh_request`, `creative_asset.refresh_success`, `creative_asset.refresh_error`).

### 4.3 Library surfaces

- `frontend/src/library/rom-detail-sheet.tsx` and `frontend/src/components/dashboard-panels.tsx` subscribe to `useCreativeAssets` to swap thumbnails when a pending asset exists. Display a "Swapping art…" toast and pixel skeleton placeholders while CDN caches warm up.
- Default to fallback art (existing ROM thumbnails) if the hook reports `refreshState === "error"`.

## 5. Next steps & ownership

- **Engineering:** Backend platform team implements refresh queues, audit logging, and integrates the storage health probe into CI.
- **Creative:** Art leads maintain the QA checklist and update palette rules in `docs/ui/wireframes.md` when direction shifts.
- **Frontend:** Reserve hooks and UI affordances during the next sprint so backend work can drop in with minimal churn.

Document owner: **Marta Chen (Ops)** – updates this playbook as storage policies or art direction change.
