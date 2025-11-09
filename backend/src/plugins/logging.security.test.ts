import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret-32-characters-minimum-value";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.PASSWORD_RESET_TTL = "1h";
process.env.USER_INVITE_EXPIRY_HOURS = "24";
process.env.STORAGE_DRIVER = "filesystem";
process.env.STORAGE_BUCKET_ASSETS = "assets";
process.env.STORAGE_BUCKET_ROMS = "roms";
process.env.STORAGE_BUCKET_BIOS = "bios";
process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";

let buildServer: typeof import("../server.js").buildServer;

describe("logging plugin security posture", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });
    await app.register(async (instance) => {
      instance.get("/log-test", async (request) => {
        request.appendLogContext({ feature: "log-shipping" });
        return {
          correlationId: request.correlationId,
          context: request.requestLogger?.context ?? {},
        };
      });
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("propagates correlation ids and structured context for collectors", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/log-test",
      headers: {
        "x-request-id": "trace-123",
        "user-agent": "Vitest",
        "x-forwarded-for": "198.51.100.10",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("trace-123");

    const payload = response.json() as {
      correlationId: string;
      context: Record<string, unknown>;
    };

    expect(payload.correlationId).toBe("trace-123");
    expect(payload.context).toMatchObject({
      requestId: "trace-123",
      method: "GET",
      route: "/log-test",
      remoteAddress: "127.0.0.1",
      userAgent: "Vitest",
      forwardedFor: "198.51.100.10",
      feature: "log-shipping",
    });
  });
});
