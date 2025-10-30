# Profile API

Authenticated users can manage their account metadata and avatar through the profile routes. All endpoints require a valid JWT access token (or an authenticated session via the frontend proxy).

> **Base URL**: `http://<backend-host>:3001`

## `GET /users/me`

Returns the caller's profile details.

**Success (200)**

```json
{
  "user": {
    "id": "user_123",
    "email": "player@example.com",
    "nickname": "retrofan",
    "displayName": "Retro Fan",
    "role": "USER",
    "avatar": {
      "storageKey": "avatars/user_123/avatar.webp",
      "mimeType": "image/webp",
      "fileSize": 48231,
      "updatedAt": "2025-01-05T18:22:11.000Z",
      "url": "https://cdn.example.com/avatar.webp",
      "signedUrlExpiresAt": "2025-01-05T18:27:11.000Z",
      "fallbackPath": "/users/me/avatar?v=1736101331000"
    }
  }
}
```

When an avatar is not configured the `avatar` field is `null`. The `url` property points to a signed URL when object storage supports it; otherwise it references the authenticated download route.

## `PATCH /users/me`

Updates profile metadata and optionally manages the avatar.

### Payload options

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `nickname` | string | ❌ | 3–32 characters, trimmed, must be unique. |
| `displayName` | string | ❌ | 1–64 characters, trimmed. |
| `removeAvatar` | boolean | ❌ | When `true`, deletes the existing avatar. |
| `avatar` | file | ❌ | Multipart file field. Accepts PNG/JPEG/WEBP up to 5 MB. |

Send JSON when only updating text fields:

```json
{
  "nickname": "pixelpirate",
  "displayName": "Pixel Pirate"
}
```

For avatar uploads (or when combining text + avatar updates) submit `multipart/form-data`. Example using `curl`:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -F "displayName=Pixel Pirate" \
  -F "avatar=@avatar.png;type=image/png" \
  http://localhost:3001/users/me
```

**Responses**

- **200** – Profile updated. Returns the same payload shape as `GET /users/me`.
- **400** – Validation error (invalid nickname/display name, unsupported avatar type, exceeding size limit, or no changes submitted).
- **401** – Missing/invalid authentication.
- **409** – Nickname already in use.

On successful avatar replacement the previous object is removed from storage.

## `GET /users/me/avatar`

Streams the current avatar or redirects to a signed URL when available.

- **200** – Binary avatar response (`Content-Type` matches the stored mime type). Only returned when signed URLs are disabled.
- **302** – Redirect to a signed URL in S3/MinIO deployments.
- **404** – No avatar configured.
- **401** – Authentication required.

Use this route for `<img>` tags when the profile payload exposes a relative `fallbackPath`.

## Validation & Limits

- Avatar uploads are limited to PNG, JPEG, or WEBP content up to **5 MB** (`USER_AVATAR_MAX_BYTES`).
- Only one avatar file can be provided per request.
- `nickname` updates obey Prisma uniqueness constraints; conflicts return HTTP 409.
- Text fields are trimmed server-side to prevent leading/trailing whitespace persistence.
