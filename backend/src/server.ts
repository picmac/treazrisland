import Fastify, { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";
import jwt from "@fastify/jwt";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import storagePlugin from "./plugins/storage.js";
import screenScraperPlugin from "./plugins/screenscraper.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerScreenScraperRoutes } from "./routes/screenscraper.js";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin/index.js";

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

  app.register(authPlugin);
  app.register(storagePlugin);

  if (registerPrisma) {
    app.register(prismaPlugin);
    app.register(screenScraperPlugin);
  }

  app.register(async (instance) => {
    await registerOnboardingRoutes(instance);
    await registerInvitationRoutes(instance);
    await registerAuthRoutes(instance);
    if (registerPrisma) {
      await registerScreenScraperRoutes(instance);
      await registerAdminRoutes(instance);
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
};
