import type { FastifyInstance } from "fastify";
import { registerAdminPlatformRoutes } from "./platforms.js";
import { registerRomUploadRoutes } from "./romUploads.js";
import { registerAdminPixelLabRoutes } from "./pixellab.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (adminScope) => {
    adminScope.addHook("preHandler", async (request, reply) => {
      await adminScope.requireAdmin(request, reply);
    });

    await registerAdminPlatformRoutes(adminScope);
    await registerRomUploadRoutes(adminScope);
    await registerAdminPixelLabRoutes(adminScope);
  }, { prefix: "/admin" });
}
