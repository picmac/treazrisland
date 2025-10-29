import fp from "fastify-plugin";
import { netplayConfig } from "../config/netplay.js";
import {
  HttpNetplaySignalingClient,
  NetplayPrismaClient,
  NetplayService
} from "../services/netplay/service.js";

export default fp(async (app) => {
  const signalingClient = new HttpNetplaySignalingClient({
    baseUrl: netplayConfig.baseUrl,
    apiKey: netplayConfig.apiKey
  });

  const service = new NetplayService({
    prisma: app.prisma as unknown as NetplayPrismaClient,
    logger: app.log.child({ module: "NetplayService" }),
    config: netplayConfig,
    signalingClient
  });

  app.decorate("netplayService", service);

  const interval = setInterval(() => {
    service.expireStaleSessions().catch((error) => {
      app.log.error({ err: error }, "Failed to expire stale netplay sessions");
    });
  }, netplayConfig.cleanupCadenceMs);

  interval.unref?.();

  app.addHook("onClose", async () => {
    clearInterval(interval);
  });
});
