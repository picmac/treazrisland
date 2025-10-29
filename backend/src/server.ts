import Fastify, { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";
import jwt from "@fastify/jwt";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";

type BuildServerOptions = {
  registerPrisma?: boolean;
};

export const buildServer = (options: BuildServerOptions = {}): FastifyInstance => {
  const { registerPrisma = true } = options;

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug"
    }
  });

  app.register(sensible);
  app.register(underPressure);
  app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_DEFAULT_POINTS,
    timeWindow: env.RATE_LIMIT_DEFAULT_DURATION * 1000
  });

  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_TTL
    }
  });

  if (registerPrisma) {
    app.register(prismaPlugin);
  }

  app.register(async (instance) => {
    await registerOnboardingRoutes(instance);
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
};
