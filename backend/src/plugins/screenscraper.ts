import fp from "fastify-plugin";
import { screenScraperConfig } from "../config/screenscraper.js";
import { flags } from "../config/flags.js";
import { ScreenScraperService } from "../services/screenscraper/service.js";

export default fp(async (app) => {
  if (!flags.screenscraper.enrichmentEnabled) {
    app.log.warn(
      "ScreenScraper enrichment disabled via feature flag; ScreenScraper service stubbed",
    );

    app.decorate("screenScraperService", null);
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
