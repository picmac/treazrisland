import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { FastifyInstance } from "fastify";

describe("observability surfaces", () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("exposes liveness health details", async () => {
    app = buildServer({ registerPrisma: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      status: string;
      uptimeSeconds: number;
      version: string;
    };

    expect(payload.status).toBe("pass");
    expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof payload.version).toBe("string");
  });

  it("reports readiness warnings when Prisma is not registered", async () => {
    app = buildServer({ registerPrisma: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      status: string;
      components: Array<{
        component: string;
        status: string;
        details?: unknown;
      }>;
    };

    expect(payload.status).toBe("warn");
    const database = payload.components.find(
      (entry) => entry.component === "database",
    );
    expect(database).toBeDefined();
    expect(database?.status).toBe("warn");
  });

  it("fails readiness when Prisma health check errors", async () => {
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", {
      systemSetting: {
        findMany: vi.fn().mockRejectedValue(new Error("connection refused")),
      },
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);

    const payload = response.json() as {
      status: string;
      components: Array<{ component: string; status: string; error?: string }>;
    };

    expect(payload.status).toBe("fail");
    const database = payload.components.find(
      (entry) => entry.component === "database",
    );
    expect(database?.status).toBe("fail");
    expect(database?.error).toContain("connection refused");
  });

  it("reports readiness warnings when Prisma tables are unavailable", async () => {
    app = buildServer({ registerPrisma: false });
    const prismaError = Object.assign(new Error("table does not exist"), {
      code: "P2021",
    });
    app.decorate("prisma", {
      systemSetting: {
        findMany: vi.fn().mockRejectedValue(prismaError),
      },
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      status: string;
      components: Array<{
        component: string;
        status: string;
        details?: Record<string, unknown>;
      }>;
    };

    expect(payload.status).toBe("warn");
    const database = payload.components.find(
      (entry) => entry.component === "database",
    );
    expect(database?.status).toBe("warn");
    expect(database?.details).toMatchObject({
      reason: "system_settings_table_missing",
    });
  });

  it("propagates correlation identifiers", async () => {
    app = buildServer({ registerPrisma: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { "x-request-id": "abc-123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("abc-123");
  });

  it("generates a correlation identifier when absent", async () => {
    app = buildServer({ registerPrisma: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect((response.headers["x-request-id"] as string).length).toBeGreaterThan(
      10,
    );
  });
});
