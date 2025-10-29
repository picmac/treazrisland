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
