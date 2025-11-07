import type { FastifyInstance } from "fastify";
import { registerAdminPlatformRoutes } from "./platforms.js";
import { registerRomUploadRoutes } from "./romUploads.js";
import { registerAdminSettingsRoutes } from "./settings.js";
import { registerCreativeAssetRoutes } from "./creative-assets.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (adminScope) => {
    adminScope.addHook("preHandler", async (request, reply) => {
      await adminScope.requireAdmin(request, reply);
    });

    await registerAdminPlatformRoutes(adminScope);
    await registerRomUploadRoutes(adminScope);
    await registerCreativeAssetRoutes(adminScope);
    await registerAdminSettingsRoutes(adminScope);
  }, { prefix: "/admin" });
}
