import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { ExtendedPrismaClient } from "../types/prisma-extensions.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: ExtendedPrismaClient;
  }
}

export default fp(async (app) => {
  const getMetrics = () =>
    (app as FastifyInstance & {
      metrics?: {
        enabled: boolean;
        prismaQueryDuration: {
          observe: (
            labels: { model: string | null; action: string; outcome: string },
            value: number,
          ) => void;
        };
      };
    }).metrics;
  const basePrisma = new PrismaClient();
  await basePrisma.$connect();

  const prisma = basePrisma.$extends({
    query: {
      $allModels: {
        $allOperations: async ({ model, operation, args, query }) => {
          const start = process.hrtime.bigint();

          try {
            const result = await query(args);
            const metrics = getMetrics();
            if (metrics?.enabled) {
              const durationSeconds =
                Number(process.hrtime.bigint() - start) / 1_000_000_000;
              metrics.prismaQueryDuration.observe(
                {
                  model: model ?? "raw",
                  action: operation,
                  outcome: "success",
                },
                durationSeconds,
              );
            }

            return result;
          } catch (error) {
            const metrics = getMetrics();
            if (metrics?.enabled) {
              const durationSeconds =
                Number(process.hrtime.bigint() - start) / 1_000_000_000;
              metrics.prismaQueryDuration.observe(
                {
                  model: model ?? "raw",
                  action: operation,
                  outcome: "error",
                },
                durationSeconds,
              );
            }

            throw error;
          }
        },
      },
    },
  });

  app.decorate("prisma", prisma as ExtendedPrismaClient);

  app.addHook("onClose", async () => {
    await basePrisma.$disconnect();
  });
});
