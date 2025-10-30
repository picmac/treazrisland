import Fastify, { FastifyInstance } from "fastify";
import pino from "pino";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
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
import { registerLibraryRoutes } from "./routes/library.js";
import { registerPlayerRoutes } from "./routes/player.js";
import { registerFavoriteRoutes } from "./routes/favorites.js";
import { registerCollectionRoutes } from "./routes/collections.js";
import { registerTopListRoutes } from "./routes/topLists.js";
import { registerUserRoutes } from "./routes/users.js";
import supportServices from "./plugins/support-services.js";
import observabilityPlugin from "./plugins/observability.js";

type BuildServerOptions = {
  registerPrisma?: boolean;
};

export const buildServer = (
  options: BuildServerOptions = {},
): FastifyInstance => {
  const { registerPrisma = true } = options;

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
        ],
        remove: true,
      },
      serializers: {
        req(request) {
          return {
            id: request.id,
            method: request.method,
            url: request.url,
            remoteAddress: request.ip,
            userId: (request as typeof request & { user?: { sub: string } })
              .user?.sub,
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
        err: pino.stdSerializers.err,
      },
    },
  });

  app.register(sensible);
  app.register(underPressure);
  app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_DEFAULT_POINTS,
    timeWindow: env.RATE_LIMIT_DEFAULT_DURATION * 1000,
    onExceeded: async (request) => {
      const routeOptions = request.routeOptions as { urlPattern?: string };
      const route =
        request.routeOptions.url ??
        routeOptions.urlPattern ??
        request.raw.url ??
        "unknown";
      const role = (request.user?.role ?? "anonymous").toLowerCase();
      request.server.metrics.rateLimit.inc({ route, role });
    },
  });

  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_TTL,
    },
  });

  app.register(multipart);

  app.register(observabilityPlugin);
  app.register(authPlugin);
  app.register(storagePlugin);
  app.register(supportServices);

  if (registerPrisma) {
    app.register(prismaPlugin);
    app.register(screenScraperPlugin);
  }

  app.register(async (instance) => {
    await registerOnboardingRoutes(instance);
    await registerInvitationRoutes(instance);
    await registerAuthRoutes(instance);
    await registerUserRoutes(instance);
    if (registerPrisma) {
      await registerScreenScraperRoutes(instance);
      await registerAdminRoutes(instance);
      await registerLibraryRoutes(instance);
      await registerPlayerRoutes(instance);
      await registerFavoriteRoutes(instance);
      await registerCollectionRoutes(instance);
      await registerTopListRoutes(instance);
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
};
