import { FastifyInstance } from "fastify";
import { z } from "zod";

const settingsSchema = z.object({
  languagePriority: z.array(z.string().min(1)).max(10).optional(),
  regionPriority: z.array(z.string().min(1)).max(10).optional(),
  mediaTypes: z.array(z.string().min(1)).max(20).optional(),
  onlyBetterMedia: z.boolean().optional(),
  maxAssetsPerType: z.number().int().min(1).max(10).optional(),
  preferParentGames: z.boolean().optional(),
});

const enrichParamsSchema = z.object({
  romId: z.string().min(1),
});

const enrichBodySchema = z.object({
  overrides: settingsSchema.optional(),
});

export async function registerScreenScraperRoutes(app: FastifyInstance) {
  if (!app.screenScraperService) {
    app.log.warn(
      "ScreenScraper service is not configured; routes will not be registered",
    );
    return;
  }

  app.register(async (instance) => {
    const service = instance.screenScraperService;

    if (!service) {
      instance.log.warn("ScreenScraper service unavailable inside route scope");
      return;
    }

    instance.addHook("onRequest", instance.requireAdmin);

    instance.get("/admin/screenscraper/status", async () => {
      return service.getStatus();
    });

    instance.get("/admin/screenscraper/settings", async (request) => {
      const userId = request.user?.sub;
      const settings = await service.getSettings(userId);
      return settings;
    });

    instance.put("/admin/screenscraper/settings", async (request, reply) => {
      const parsed = settingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid ScreenScraper settings payload",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const userId = request.user?.sub;
      if (!userId) {
        return reply
          .status(400)
          .send({ message: "Authenticated user is required" });
      }

      const record = await service.updateUserSettings(userId, parsed.data);

      return {
        settings: record,
      };
    });

    instance.post("/admin/roms/:romId/enrich", async (request, reply) => {
      const params = enrichParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          message: "Invalid ROM identifier",
          errors: params.error.flatten().fieldErrors,
        });
      }

      const body = enrichBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          message: "Invalid enrichment payload",
          errors: body.error.flatten().fieldErrors,
        });
      }

      const userId = request.user?.sub;
      if (!userId) {
        return reply
          .status(400)
          .send({ message: "Authenticated user is required" });
      }

      const job = await service.enqueueEnrichmentJob({
        romId: params.data.romId,
        requestedById: userId,
        overrides: body.data.overrides,
      });

      instance.metrics.enrichment.inc({ status: "scheduled" });
      request.log.info(
        {
          event: "rom.enrichment.enqueued",
          romId: params.data.romId,
          jobId: job.id,
          requestedById: userId,
        },
        "Enrichment job queued",
      );

      return reply.status(202).send({
        job,
      });
    });
  });
}
