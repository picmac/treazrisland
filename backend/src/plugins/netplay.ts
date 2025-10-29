import fp from "fastify-plugin";
import { netplayConfig } from "../config/netplay.js";
import { NetplayService } from "../services/netplay/service.js";

export default fp(async (app) => {
  const service = new NetplayService({
    prisma: app.prisma,
    logger: app.log.child({ module: "NetplayService" }),
    config: netplayConfig
  });

  app.decorate("netplayService", service);
});
