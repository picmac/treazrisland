# Library API

The library endpoints expose the player-facing catalog used by the Next.js frontend. All routes
require a valid JWT access token unless noted otherwise.

## `GET /platforms`

Returns the list of platforms with ROM counts and a featured ROM preview. Supports optional query
parameters:

| Query        | Type    | Description                                                   |
|--------------|---------|---------------------------------------------------------------|
| `search`     | string  | Fuzzy match against platform name or short name               |
| `includeEmpty` | bool  | When `true`, include platforms with zero ROMs (default false) |

**Response**

```json
{
  "platforms": [
    {
      "id": "platform_1",
      "name": "Nintendo Entertainment System",
      "slug": "nes",
      "shortName": "NES",
      "screenscraperId": 1,
      "romCount": 42,
      "featuredRom": {
        "id": "rom_123",
        "title": "Metroid",
        "updatedAt": "2025-01-08T12:00:00.000Z",
        "assetSummary": {
          "cover": { "id": "asset_1", "storageKey": "covers/rom_123.png" },
          "screenshots": [],
          "videos": [],
          "manuals": []
        }
      }
    }
  ]
}
```

## `GET /roms`

Returns a paginated list of ROM summaries for discovery. Accepted query parameters:

| Query        | Type                    | Description                                                     |
|--------------|-------------------------|-----------------------------------------------------------------|
| `platform`   | string                  | Platform slug                                                   |
| `search`     | string                  | Match against title or summary text                             |
| `publisher`  | string                  | Filter metadata by publisher name                               |
| `year`       | integer                 | Filter by release year                                          |
| `sort`       | `title` \| `releaseYear` \| `publisher` \| `createdAt` | Sort field                             |
| `direction`  | `asc` \| `desc`         | Sort direction (default `asc`)                                  |
| `page`       | integer                 | Page number (1-indexed, default `1`)                            |
| `pageSize`   | integer                 | Items per page (default `24`, max `60`)                         |

**Response**

```json
{
  "page": 1,
  "pageSize": 24,
  "total": 120,
  "roms": [
    {
      "id": "rom_123",
      "title": "Chrono Trigger",
      "platform": { "slug": "snes", "name": "Super Nintendo Entertainment System" },
      "releaseYear": 1995,
      "players": 1,
      "metadata": {
        "source": "SCREEN_SCRAPER",
        "summary": "Epic time-travelling RPG adventure.",
        "publisher": "Square"
      },
      "assetSummary": {
        "cover": { "id": "asset_10", "storageKey": "covers/rom_123.png" },
        "screenshots": [ { "id": "asset_11" } ],
        "videos": [],
        "manuals": []
      }
    }
  ]
}
```

## `GET /roms/:id`

Returns full metadata for a ROM, including enrichment jobs and upload audits. Responds with HTTP 404
when the ROM cannot be found.

## `GET /roms/:id/assets`

Lists assets for a ROM. Optional query parameters:

| Query | Type           | Description                                                        |
|-------|----------------|--------------------------------------------------------------------|
| `types` | string        | Comma-separated list of asset types (e.g. `COVER,SCREENSHOT`)      |
| `limit` | integer (≤100)| Maximum number of assets to return (default `50`)                 |

Response includes both the raw assets and a derived `assetSummary` grouped by cover, screenshots,
videos, and manuals.

## `GET /favorites`

Returns the authenticated user's favorite ROM identifiers ordered by most recent activity.

**Response**

```json
{
  "favorites": [
    { "romId": "rom_123", "createdAt": "2025-02-14T12:34:00.000Z" }
  ]
}
```

## `POST /favorites/:romId`

Marks a ROM as a favorite for the current user. Duplicate requests return HTTP 204 without an
error to keep the interaction idempotent. Returns HTTP 404 when the ROM does not exist.

**Response**

```json
{
  "favorite": { "romId": "rom_123", "createdAt": "2025-02-14T12:34:00.000Z" }
}
```

## `DELETE /favorites/:romId`

Removes a ROM from the caller's favorites. The route always returns HTTP 204, even when the ROM was
not previously marked as a favorite.

## `GET /collections`

Lists published ROM collections with ordered entries. Each collection surfaces high-level metadata
along with the associated ROM IDs and platform context.

**Response**

```json
{
  "collections": [
    {
      "id": "collection_1",
      "slug": "treaz-essentials",
      "title": "Treaz Essentials",
      "description": "Must-play picks across platforms",
      "isPublished": true,
      "createdAt": "2025-02-01T00:00:00.000Z",
      "updatedAt": "2025-02-14T08:00:00.000Z",
      "createdById": "user_admin",
      "roms": [
        {
          "id": "rom_123",
          "title": "Chrono Trigger",
          "position": 1,
          "note": "Time-traveling classic",
          "platform": {
            "id": "platform_snes",
            "name": "Super Nintendo",
            "slug": "snes",
            "shortName": "SNES"
          }
        }
      ]
    }
  ]
}
```

## `GET /collections/:slug`

Returns a single published collection by slug. Responds with HTTP 404 when the slug is unknown or
the collection has not been published yet.

## `GET /top-lists`

Surfaces curated top lists that have been published. Entries include the ranked ROM, platform
context, and optional blurbs describing the pick.

**Response**

```json
{
  "topLists": [
    {
      "id": "toplist_1",
      "slug": "february-legends",
      "title": "February Legends",
      "description": "Community favorites for the month",
      "publishedAt": "2025-02-15T00:00:00.000Z",
      "effectiveFrom": "2025-02-01T00:00:00.000Z",
      "effectiveTo": "2025-02-29T00:00:00.000Z",
      "createdAt": "2025-02-01T00:00:00.000Z",
      "updatedAt": "2025-02-15T00:00:00.000Z",
      "createdById": "user_admin",
      "entries": [
        {
          "id": "entry_1",
          "romId": "rom_123",
          "title": "Chrono Trigger",
          "rank": 1,
          "blurb": "Era-defining RPG",
          "platform": {
            "id": "platform_snes",
            "name": "Super Nintendo",
            "slug": "snes",
            "shortName": "SNES"
          }
        }
      ]
    }
  ]
}
```

## `GET /top-lists/:slug`

Returns a single published top list by slug. Responds with HTTP 404 when no published list matches
the provided slug.
