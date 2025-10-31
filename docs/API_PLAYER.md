# Player API

The player routes serve ROM binaries, auxiliary assets, and cloud-backed save states. All endpoints require JWT authentication, and rate limits scale with user roles (`ADMIN` receives higher throughput).

> **Base URL**: `http://<backend-host>:3001`

## ROM Binary Streaming

### `GET /player/roms/:id/binary`

Retrieves the packaged ROM archive for the specified ROM. The handler attempts to generate a signed URL first; if unavailable it streams directly from object storage.

- **Auth**: Required (`app.authenticate`).
- **Rate limit**: 30 requests/minute for players, 120/minute for admins.

**Path Parameters**

| Param | Type   | Notes |
|-------|--------|-------|
| `id`  | string | ROM identifier from the library catalog. |

**Success (200)**

Depending on storage configuration, responses look like either:

```jsonc
{ // Signed URL response
  "type": "signed-url",
  "url": "https://storage/roms/abc.zip?X-Amz-Signature=...",
  "expiresAt": "2025-01-12T19:00:00.000Z",
  "size": 4194304,
  "contentType": "application/zip"
}
```

or an octet-stream body with appropriate `Content-Type`/`Content-Length` headers.

**Errors**

- `404`: ROM missing, binary absent, or not yet processed (`status !== READY`).

All downloads are recorded in `rom_playback_audit` with action `ROM_DOWNLOAD`.

---

## Asset Delivery

### `GET /rom-assets/:assetId`

Returns auxiliary ROM assets such as covers, manuals, or soundtracks. External assets short-circuit with the stored URL; local assets proxy through the storage layer.

- **Auth**: Required.
- **Rate limit**: Same adaptive limit as ROM downloads.

**Path Parameters**

| Param     | Type   | Notes |
|-----------|--------|-------|
| `assetId` | string | Asset identifier from ROM metadata. |

**Success**

- External asset:

```json
{ "type": "external", "url": "https://cdn.example/manuals/abc.pdf" }
```

- Signed URL or proxied stream for locally stored assets (includes optional `size` and `format`).

**Errors**

- `404`: Asset not found or storage key missing.

Playback audits emit action `ASSET_DOWNLOAD` with associated ROM context when available.

---

## Save-State Management

All save-state routes enforce ownership: the authenticated user must match the play-state `userId`.

### `GET /player/play-states`

Lists the caller's save states, optionally filtered by ROM.

| Query  | Type   | Notes |
|--------|--------|-------|
| `romId`| string | Filter to a specific ROM when provided. |

**Success (200)**

```json
{
  "playStates": [
    {
      "id": "ps_123",
      "romId": "rom_456",
      "label": "Dungeon Entrance",
      "slot": 1,
      "size": 20480,
      "checksumSha256": "...",
      "createdAt": "2025-01-10T05:00:00.000Z",
      "updatedAt": "2025-01-10T05:00:00.000Z",
      "downloadUrl": "/player/play-states/ps_123/binary"
    }
  ]
}
```

### `GET /player/play-states/recent`

Returns up to 10 of the most recent save states for the authenticated user. Each entry embeds ROM
metadata and a condensed asset summary so the frontend can present “resume” tiles without issuing
additional library requests.

- **Auth**: Required.
- **Rate limit**: Same adaptive limit as other player routes.

**Success (200)**

```json
{
  "recent": [
    {
      "playState": {
        "id": "ps_123",
        "romId": "rom_456",
        "label": "Dungeon Entrance",
        "slot": 1,
        "size": 20480,
        "checksumSha256": "...",
        "createdAt": "2025-01-10T05:00:00.000Z",
        "updatedAt": "2025-01-12T08:30:00.000Z",
        "downloadUrl": "/player/play-states/ps_123/binary"
      },
      "rom": {
        "id": "rom_456",
        "title": "Chrono Trigger",
        "platform": {
          "id": "platform_snes",
          "name": "Super Nintendo",
          "slug": "snes",
          "shortName": "SNES"
        },
        "assetSummary": {
          "cover": { "id": "asset_1", "storageKey": "covers/rom_456.png" },
          "screenshots": [],
          "videos": [],
          "manuals": []
        }
      }
    }
  ]
}
```

### `GET /player/play-states/:id`

Fetches metadata for a single save state owned by the caller.

- **Errors**: `401` when unauthenticated, `404` for missing or foreign states.

### `GET /player/play-states/:id/binary`

Downloads the binary payload. Returns a signed URL when available or streams an octet payload with `Content-Length`.

- **Errors**: `401` unauthorized, `404` when not found.
- **Audit**: `PLAY_STATE_DOWNLOAD` events recorded with IP/user agent metadata.

### `POST /player/play-states`

Creates a new save state from base64-encoded data.

| Field    | Type    | Required | Notes |
|----------|---------|----------|-------|
| `romId`  | string  | ✅        | Must reference an existing ROM. |
| `label`  | string  | ❌        | Trimmed label (max 120 chars). |
| `slot`   | integer | ❌        | 0-99. Replaces any existing state occupying the slot. |
| `data`   | string  | ✅        | Base64-encoded binary payload. Whitespace is stripped before validation. |

**Behavior**

- Rejects payloads larger than `PLAY_STATE_MAX_BYTES`.
- Uploads the decoded binary to the asset bucket (`application/octet-stream`).
- Removes older states when the per-ROM quota (`PLAY_STATE_MAX_PER_ROM`) is exceeded.
- Emits `PLAY_STATE_UPLOAD` audit events.

**Success (201)**

Returns the serialized play state (same shape as `GET /player/play-states/:id`).

### `PATCH /player/play-states/:id`

Updates save-state metadata or payload. Provide any combination of `label`, `slot`, or `data`.

- When updating `data`, the binary is re-uploaded with checksum recalculation, slot conflicts are resolved, and an upload audit entry is recorded.
- Slot changes evict conflicting states owned by the user.

**Errors**

- `400`: Missing update fields or payload exceeds byte limit.
- `404`: Save state missing or not owned by the caller.

### `DELETE /player/play-states/:id`

Deletes the save state and purges the underlying object from storage.

- **Success (204)**: No body.
- **Errors**: `404` when the state is absent or belongs to another user.

Deletion silently succeeds after removing storage objects; failures are logged but do not leak internal errors to clients.
