import Fastify, { FastifyInstance } from "fastify";
import pino from "pino";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";
import jwt from "@fastify/jwt";
import { env, bootstrapSecrets } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import corsPlugin from "./plugins/cors.js";
import storagePlugin from "./plugins/storage.js";
import screenScraperPlugin from "./plugins/screenscraper.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerScreenScraperRoutes } from "./routes/screenscraper.js";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin/index.js";
import { registerLibraryRoutes } from "./routes/library/index.js";
import { registerPlayerRoutes } from "./routes/player.js";
import { registerPlayRoutes } from "./routes/play/index.js";
import { registerPlayStateRoutes } from "./routes/play-states/index.js";
import { registerFavoriteRoutes } from "./routes/favorites.js";
import { registerCollectionRoutes } from "./routes/collections.js";
import { registerTopListRoutes } from "./routes/topLists.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerNetplayRoutes } from "./routes/netplay.js";
import { registerHealthRoutes } from "./routes/health.js";
import supportServices from "./plugins/support-services.js";
import metricsPlugin from "./plugins/metrics.js";
import settingsPlugin from "./plugins/settings.js";
import loggingPlugin from "./plugins/logging.js";
import enforceHttpsPlugin from "./plugins/enforce-https.js";
import healthPlugin from "./plugins/health.js";
import { registerRomRoutes } from "./routes/roms/index.js";
import {
  fetchSetupState,
  ONBOARDING_STEP_KEYS,
} from "./services/setup/state.js";
import { bootstrapInitialAdmin } from "./services/setup/bootstrap-admin.js";

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
  app.register(corsPlugin);
  app.register(loggingPlugin);
  app.register(enforceHttpsPlugin);
  app.register(async (instance) => {
    await instance.register(healthPlugin);
    registerHealthRoutes(instance);
  });
  app.register(underPressure, {
    healthCheck: async () => {
      if (!app.hasDecorator("health")) {
        return true;
      }

      const report = await app.health.ready();
      return report.status !== "fail";
    },
    healthCheckInterval: 10_000,
    pressureHandler: async (request, reply, type) => {
      if (request.raw.url?.startsWith("/health")) {
        if (app.hasDecorator("health")) {
          const report = await app.health.ready();
          return reply.code(report.status === "fail" ? 503 : 200).send(report);
        }

        return reply.code(503).send({ status: "fail", reason: type });
      }

      return reply
        .code(503)
        .send({ status: "fail", reason: type ?? "unknown" });
    },
    exposeStatusRoute: {
      url: "/health/system",
      routeOpts: {
        logLevel: "warn",
      },
    },
  });
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
      const logger = request.requestLogger ?? request.log;
      logger.warn(
        { event: "rate_limit.exceeded", route, role, ip: request.ip },
        "rate limit exceeded",
      );
    },
  });

  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_TTL,
    },
  });

  const registerCorePlugins = () => {
    app.register(settingsPlugin);
    app.register(metricsPlugin);
    app.register(authPlugin);
    app.register(storagePlugin);
    app.register(supportServices);
  };

  if (registerPrisma) {
    app.register(prismaPlugin);
    app.after((error) => {
      if (error) {
        throw error;
      }
      registerCorePlugins();
    });
  } else {
    registerCorePlugins();
  }

  if (registerPrisma) {
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
      await registerPlayRoutes(instance);
      await registerPlayStateRoutes(instance);
      await registerPlayerRoutes(instance);
      await registerFavoriteRoutes(instance);
      await registerCollectionRoutes(instance);
      await registerTopListRoutes(instance);
      await registerStatsRoutes(instance);
      await registerNetplayRoutes(instance);
    }
    await registerRomRoutes(instance);
  });

  app.get("/health/setup", async () => {
    const secrets = {
      configRoot: bootstrapSecrets.configRoot,
      secretsFile: bootstrapSecrets.secretsFile,
      generated: bootstrapSecrets.didGenerate,
    };

    if (!registerPrisma || !app.hasDecorator("prisma")) {
      return {
        secrets,
        setupComplete: false,
        pendingSteps: ONBOARDING_STEP_KEYS,
      };
    }

    const state = await fetchSetupState(app.prisma);
    const pending = Object.entries(state.steps)
      .filter(([, step]) => step.status === "PENDING")
      .map(([key]) => key);

    return {
      secrets,
      setupComplete: state.setupComplete,
      pendingSteps: pending,
    };
  });

  app.addHook("onReady", async () => {
    if (!app.hasDecorator("prisma")) {
      return;
    }

    await bootstrapInitialAdmin({
      prisma: app.prisma,
      log: app.log.child({ context: "bootstrap-admin" }),
    });
  });

  return app;
};
