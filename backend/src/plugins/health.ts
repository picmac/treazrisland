import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import packageInfo from "../../package.json" with { type: "json" };

export type HealthComponentStatus = {
  component: string;
  status: "pass" | "fail" | "warn";
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
};

export type HealthReport = {
  status: "pass" | "fail" | "warn";
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  components: HealthComponentStatus[];
};

export type HealthManager = {
  live: () => Promise<HealthReport>;
  ready: () => Promise<HealthReport>;
};

function summarizeStatus(
  checks: HealthComponentStatus[],
): "pass" | "fail" | "warn" {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }

  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }

  return "pass";
}

function baseReport(): Pick<
  HealthReport,
  "timestamp" | "uptimeSeconds" | "version"
> {
  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    version: packageInfo.version ?? "0.0.0",
  };
}

async function checkDatabase(
  app: FastifyInstance,
): Promise<HealthComponentStatus> {
  if (!app.hasDecorator("prisma")) {
    return {
      component: "database",
      status: "warn",
      details: { registered: false },
    };
  }

  const prisma = (app as FastifyInstance & { prisma: PrismaClient }).prisma;
  const start = process.hrtime.bigint();

  try {
    const systemSettingDelegate = (
      prisma as {
        systemSetting?: { findMany?: () => Promise<unknown> };
      }
    ).systemSetting;

    if (typeof systemSettingDelegate?.findMany !== "function") {
      return {
        component: "database",
        status: "warn",
        latencyMs: Number(process.hrtime.bigint() - start) / 1_000_000,
        details: { probe: "systemSetting", available: false },
      };
    }

    await systemSettingDelegate.findMany();
    return {
      component: "database",
      status: "pass",
      latencyMs: Number(process.hrtime.bigint() - start) / 1_000_000,
    };
  } catch (error) {
    app.log.error({ err: error }, "database health check failed");
    return {
      component: "database",
      status: "fail",
      latencyMs: Number(process.hrtime.bigint() - start) / 1_000_000,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function checkMetrics(app: FastifyInstance): HealthComponentStatus {
  if (!app.hasDecorator("metrics")) {
    return {
      component: "metrics",
      status: "warn",
      details: { registered: false },
    };
  }

  const metrics = app.metrics;
  if (!metrics.enabled) {
    return {
      component: "metrics",
      status: "pass",
      details: { enabled: false, reason: "disabled" },
    };
  }

  return {
    component: "metrics",
    status: "pass",
    details: { enabled: true },
  };
}

function respond(reply: FastifyReply, report: HealthReport): HealthReport {
  if (report.status === "fail") {
    reply.code(503);
  }

  return report;
}

export default fp(async (app: FastifyInstance) => {
  const manager: HealthManager = {
    live: async () => ({
      ...baseReport(),
      status: "pass",
      components: [],
    }),
    ready: async () => {
      const checks = [await checkDatabase(app), checkMetrics(app)];
      return {
        ...baseReport(),
        status: summarizeStatus(checks),
        components: checks,
      };
    },
  };

  app.decorate("health", manager);

  app.get("/health/live", async (_request, reply) =>
    respond(reply, await manager.live()),
  );
  app.get("/health/ready", async (_request, reply) =>
    respond(reply, await manager.ready()),
  );
  app.get("/health", async (_request, reply) =>
    respond(reply, await manager.ready()),
  );
});
