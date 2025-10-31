import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  systemProfileSchema,
  storageSchema,
  emailSchema,
  metricsSchema,
  screenscraperSchema,
  personalizationSchema,
} from "../../plugins/settings.js";

const settingsUpdateSchema = z
  .object({
    systemProfile: systemProfileSchema.partial().optional(),
    storage: storageSchema.partial().optional(),
    email: emailSchema.partial().optional(),
    metrics: metricsSchema.partial().optional(),
    screenscraper: screenscraperSchema.partial().optional(),
    personalization: personalizationSchema.partial().optional(),
  })
  .strict();

export async function registerAdminSettingsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/settings", async () => {
    return app.settings.get();
  });

  app.put("/settings", async (request, reply) => {
    const validation = settingsUpdateSchema.safeParse(request.body ?? {});
    if (!validation.success) {
      return reply.status(400).send({
        message: "Invalid settings payload",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const updated = await app.settings.update(validation.data, {
      actorId: request.user?.sub,
    });

    return updated;
  });
}
