# Curated Lists QA Checklist

The curated lists surface two new library entry points:

- **Top lists** – ranked ROM spotlights with platform context and curator blurbs.
- **Collections** – thematic ROM groupings meant for marathons or highlights.

## Access

1. From the dashboard quick-start section, click **Browse top lists** or **View collections**.
2. Direct URLs also work: `/top-lists`, `/top-lists/{slug}`, `/collections`, `/collections/{slug}`.

## Top lists index

- Loading message: "Charting curated waters… fetching top lists." appears until the API resolves.
- Error banner: red pixel-frame with the API error message if the request fails.
- Empty state: "No curated top lists have been published yet." shows when the API returns an empty array.
- Cards display title, published date (or Draft), entry count, and the first-ranked ROM badge.

## Top list detail

- Header shows title, description, and published timestamp.
- Loading message: "Mapping each treasure slot…" while waiting for data.
- Error banner for 404 or fetch failures (e.g., "Top list not found").
- Ranked table lists ROM titles, platform abbreviations, and curator blurbs. Empty lists show "No ROMs have been ranked in this list yet."

## Collections index

- Loading message: "Sorting the vault… gathering collections." until data returns.
- Error banner mirrors the top lists index when the fetch fails.
- Empty state: "No collections have been assembled yet." when zero results.
- Cards display title, publish state, number of ROMs curated, and opener ROM highlight.

## Collection detail

- Header shows collection title, description, and publication state.
- Loading message: "Hoisting ROM crates…" while fetching.
- Error banner for missing collections or other failures.
- Ordered table lists ROM titles, platform abbreviations, and optional curator notes. Empty collections render "This collection is empty."

## Regression checks

- Confirm dashboard links still reach the platforms explorer and new curated pages.
- Verify back navigation or direct URL entry keeps you in the authenticated layout.
- Ensure pixel-frame styling matches other library pages (borders, hover states, uppercase metadata).
