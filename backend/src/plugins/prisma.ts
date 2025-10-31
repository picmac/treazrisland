import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (app) => {
  const prisma = new PrismaClient();
  await prisma.$connect();

  prisma.$use(async (params, next) => {
    const start = process.hrtime.bigint();

    try {
      const result = await next(params);
      if (app.metrics.enabled) {
        const durationSeconds =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        app.metrics.prismaQueryDuration.observe(
          {
            model: params.model ?? "raw",
            action: params.action,
            outcome: "success",
          },
          durationSeconds,
        );
      }

      return result;
    } catch (error) {
      if (app.metrics.enabled) {
        const durationSeconds =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        app.metrics.prismaQueryDuration.observe(
          {
            model: params.model ?? "raw",
            action: params.action,
            outcome: "error",
          },
          durationSeconds,
        );
      }

      throw error;
    }
  });

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
