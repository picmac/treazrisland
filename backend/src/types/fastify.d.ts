import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import type { ScreenScraperService } from "../services/screenscraper/service.js";
import type { StorageService } from "../services/storage/storage.js";
import type { EmailService } from "../services/email/service.js";
import type { MfaService } from "../services/mfa/service.js";
import type { ObservabilityMetrics } from "../plugins/metrics.js";
import type { SettingsManager } from "../plugins/settings.js";
import type { HealthManager } from "../plugins/health.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    requireRole: (
      role: Role,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    screenScraperService: ScreenScraperService | null;
    storage: StorageService;
    emailService: EmailService;
    mfaService: MfaService;
    metrics: ObservabilityMetrics;
    settings: SettingsManager;
    health: HealthManager;
  }

  interface FastifyRequest {
    user?: { sub: string; role: Role };
    metricsStartTime?: bigint;
    requestStartTime?: bigint;
    correlationId?: string;
    requestLogger?: FastifyBaseLogger & { context?: Record<string, unknown> };
    appendLogContext: (context: Record<string, unknown>) => void;
  }
}
