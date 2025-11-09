export const flags = {
  screenscraper: {
    enrichmentEnabled:
      process.env.FLAG_SCREENSCRAPER_ENRICHMENT === "1" ||
      process.env.FLAG_SCREENSCRAPER_ENRICHMENT === "true",
  },
} as const;

// TODO: Wire real ScreenScraper job orchestration once enrichment is in scope for MVP.
