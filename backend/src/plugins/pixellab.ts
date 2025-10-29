import fp from "fastify-plugin";
import { getPixelLabConfig } from "../config/pixellab.js";
import { PixelLabService } from "../services/pixellab/service.js";

declare module "fastify" {
  interface FastifyInstance {
    pixelLabService?: PixelLabService;
  }
}

export default fp(async (app) => {
  const config = getPixelLabConfig();
  if (!config) {
    app.log.warn("PixelLab service is not configured; PixelLab routes will be disabled");
    return;
  }

  if (!app.prisma) {
    throw new Error("Prisma plugin must be registered before PixelLab service");
  }

  const service = new PixelLabService({
    prisma: app.prisma,
    storage: app.storage,
    logger: app.log.child({ module: "PixelLabService" }),
    config
  });

  app.decorate("pixelLabService", service);
});
