# Creative Asset Pipeline & Storage Integration

This playbook documents how TREAZRISLAND sources pixel art, connects it to object storage, and equips administrators and frontend engineers with the tools needed to refresh and swap creative assets safely.

## 1. Art sourcing process

1. **Ingestion targets**
   - Primary enrichment source: ScreenScraper API using the curated media filters defined in `.env.example` (`SCREENSCRAPER_DEFAULT_MEDIA_TYPES`, language and region priorities).
   - Secondary sources: manually curated uploads from the art team and partner studios. Manual uploads must arrive with provenance metadata (artist, license, upstream URL) stored alongside the asset record in Prisma.
2. **Acquisition workflow**
   1. Admin triggers ingestion from `/admin/creative-assets` or queues a background job (`creativeAssetEnrichment.enqueue`).
   2. Backend fetches media, writes temporary files to `./var/storage/tmp`, and records fetch status (success, format mismatch, corrupted download) in the enrichment queue table.
   3. Successful candidates are normalized to PNG/WebP, downscaled to the SNES-inspired frame sizes (max width 720px) and padded to preserve pixel integrity.
   4. QA passes include palette verification against the pixel theme, compression artifact checks, and confirmation that focus characters are centered.
   5. Approved art is versioned into the `treaz-assets` bucket under `art/platform/<slug>/` or `art/rom/<romId>/` keys. Metadata (ROM/platform mapping, credit, checksum) is persisted in Prisma for future refresh audits.
3. **Rejection handling**
   - Any failed fetch or QA step moves the queue item into a retry state with the reason recorded (`FETCH_ERROR`, `FORMAT_UNSUPPORTED`, `QA_REJECTED`).
   - Operators can triage from the admin dashboard, override with a manual upload, or blacklist the source asset ID to prevent repeated downloads.

## 2. MinIO / S3 credentials and configuration

TREAZRISLAND runs on MinIO in development and can target S3-compatible stores in production. Connect the backend using service accounts with least privilege.

1. **Provision credentials**
   ```bash
   # Run from ops workstation; never commit secrets
   mc alias set treaz-admin https://minio.staging.treaz.lan $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
   mc admin user add treaz-admin creative-assets <32-byte-generated-secret>
   mc admin policy attach treaz-admin readwrite --user creative-assets
   ```
   - The `creative-assets` user is scoped to buckets defined below; avoid reusing the root credentials.
2. **Bucket layout**
   - `treaz-assets`: curated art, box art, wheels, marquees.
   - `treaz-roms`: ROM archives (read-only for creative tooling).
   - `treaz-bios`: BIOS references (read-only for creative tooling).
   - Ensure bucket versioning and SSE-S3 encryption are enabled (`mc version enable`, `mc encrypt set sse-s3`).
3. **Environment variables**
   - Update `.env` per `.env.example`:
     - `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_FORCE_PATH_STYLE`
     - `STORAGE_ACCESS_KEY=creative-assets`
     - `STORAGE_SECRET_KEY=<generated secret>`
     - `STORAGE_BUCKET_ASSETS=treaz-assets`
   - Keep `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` solely for bootstrap jobs such as `infra/minio/setup.sh`.
4. **Connectivity validation**
   ```bash
   npm run storage:health --prefix backend
   # Confirms signed URL generation, write/read cycle against treaz-assets
   ```
   - For S3 environments, set `STORAGE_ENDPOINT=https://s3.<region>.amazonaws.com` and disable `STORAGE_FORCE_PATH_STYLE` if virtual-hosted-style URLs are required.

## 3. Admin tooling requirements

1. **Asset refresh operations**
   - Provide `POST /admin/assets/:id/refresh` for manual refresh; endpoint enqueues a job with idempotency keys (`assetId`, `source`, `checksum`).
   - Scheduled refresh worker runs nightly, scanning assets older than 90 days and revalidating availability and checksum drift.
   - Refresh jobs must purge superseded object versions, retain previous version ID for rollback, and emit audit logs (`asset_refresh_completed`).
   - Surface job telemetry in `/admin/creative-assets`: queue length, last run, failures grouped by reason.
2. **Authorization controls**
   - Endpoints require `requireRole("ADMIN")`; introduce a `CURATOR` role flag for art team members with limited scope to enqueue refreshes but not alter policies.
   - UI actions follow the same guard: show refresh/rollback buttons only to `ADMIN` or `CURATOR` and disable with tooltip when lacking permission.
   - Log all refresh requests with actor ID, asset ID, and outcome to `AuditLog`.
   - Include feature flag `ENABLE_ASSET_REFRESH_UI` for gradual rollout; default false in production.

## 4. Frontend coordination & reserved hooks

1. **Hook reservation**
   - Add `frontend/src/hooks/useCreativeAssets.ts` exporting:
     ```ts
     interface CreativeAssetRecord {
       id: string;
       romId?: string;
       platformSlug?: string;
       currentAssetUrl: string;
       pendingAssetUrl?: string;
       refreshState: "idle" | "refreshing" | "error";
     }
     export function useCreativeAssets() { /* fetch + mutation stubs */ }
     ```
     - Hook should compose `lib/api` client; leave mutation bodies as TODOs until backend endpoints land.
2. **Admin UI wiring**
   - `frontend/src/admin/creative-assets/CreativeAssetManager.tsx` consumes the hook, renders refresh CTA, rollback menu, and status badges (idle/refreshing/error) consistent with pixel-frame styling.
   - Reserve CSS utility classes (`data-asset-refresh`) to allow QA automation to target swap actions.
   - Introduce event emitters for analytics (`creative_asset.refresh_request`, `creative_asset.refresh_success`) via the existing telemetry context.
3. **Library surfaces**
   - `frontend/src/library/rom-detail-sheet.tsx` and `frontend/src/components/dashboard-panels.tsx` should read from `useCreativeAssets` to swap thumbnails when an asset enters `pending` state, displaying a "Swapping art…" toast.
   - Provide skeleton placeholders for fallback art while new assets propagate via CDN.

## 5. Next steps & ownership

- **Engineering:** Backend platform team to implement queue processing and audit logging, referencing this document for storage credentials.
- **Creative:** Art leads to maintain sourcing QA checklist and update palette guidelines in `docs/ui/wireframes.md` when styles evolve.
- **Frontend:** Reserve hooks and UI affordances in the next sprint so asset refresh features can land without design churn.

Document owner: **Marta Chen (Ops)** – updates this playbook as storage policies or art direction change.
