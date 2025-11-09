import fp from "fastify-plugin";
import { screenScraperConfig } from "../config/screenscraper.js";
import { flags } from "../config/flags.js";
import { ScreenScraperService } from "../services/screenscraper/service.js";

export default fp(async (app) => {
  if (!flags.screenscraper.enrichmentEnabled) {
    app.log.warn(
      "ScreenScraper enrichment disabled via feature flag; registering stub service",
    );

    const stub = {
      isEnabled: () => false,
      getStatus: () => ({
        enabled: false,
        diagnostics: screenScraperConfig.diagnostics,
      }),
      async getSettings() {
        const defaults = {
          languagePriority: screenScraperConfig.languagePriority,
          regionPriority: screenScraperConfig.regionPriority,
          mediaTypes: screenScraperConfig.mediaTypes,
          onlyBetterMedia: screenScraperConfig.onlyBetterMedia,
          maxAssetsPerType: screenScraperConfig.maxAssetsPerType,
          preferParentGames: true,
        } as const;

        return {
          defaults,
          user: null,
          effective: defaults,
        };
      },
      async updateUserSettings() {
        throw new Error(
          "ScreenScraper enrichment is currently disabled. Enable FLAG_SCREENSCRAPER_ENRICHMENT to allow settings updates.",
        );
      },
      async enqueueEnrichmentJob() {
        throw new Error(
          "ScreenScraper enrichment is currently disabled. Enable FLAG_SCREENSCRAPER_ENRICHMENT to process jobs.",
        );
      },
    } satisfies Partial<ScreenScraperService>;

    app.decorate(
      "screenScraperService",
      stub as ScreenScraperService,
    );
    return;
  }

  const service = new ScreenScraperService({
    prisma: app.prisma,
    logger: app.log.child({ module: "ScreenScraperService" }),
    config: screenScraperConfig,
    onQueueDepthChange: (depth) => {
      app.metrics.enrichmentQueueDepth.set({}, depth);
    },
    onJobStatusChange: (status) => {
      app.metrics.enrichment.inc({ status });
    },
    onJobDuration: (phase, durationSeconds) => {
      app.metrics.enrichmentJobDuration.observe(
        { phase },
        durationSeconds,
      );
    },
  });

  app.decorate("screenScraperService", service);
});
