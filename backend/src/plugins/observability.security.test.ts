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
process.env.MFA_ISSUER = "TREAZRISLAND";
process.env.MFA_RECOVERY_CODE_COUNT = "4";
process.env.MFA_RECOVERY_CODE_LENGTH = "8";
process.env.METRICS_ENABLED = "true";
process.env.METRICS_TOKEN = "test-metrics-token";
process.env.METRICS_ALLOWED_CIDRS = "10.10.0.0/16,127.0.0.1/32";

let buildServer: typeof import("../server.js").buildServer;

describe("/metrics endpoint hardening", () => {
  let app: FastifyInstance;
  let env: typeof import("../config/env.js").env;

  beforeAll(async () => {
    ({ env } = await import("../config/env.js"));
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", {
      loginAudit: { create: async () => ({}) },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("allows authenticated scrapes from permitted networks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: "10.10.24.5",
      headers: {
        authorization: `Bearer ${process.env.METRICS_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBeDefined();
    expect(response.headers["content-type"]!).toContain("text/plain");
  });

  it("rejects scrapes from disallowed networks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: "198.51.100.42",
      headers: {
        authorization: `Bearer ${process.env.METRICS_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Forbidden" });
  });

  it("requires the metrics token even from allowed networks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: "10.10.24.5",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Unauthorized" });
  });

  it("denies scrapes when no safeguards are configured", async () => {
    const originalAllowedCidrs = [...env.METRICS_ALLOWED_CIDRS];
    const originalToken = env.METRICS_TOKEN;

    try {
      env.METRICS_ALLOWED_CIDRS.splice(0, env.METRICS_ALLOWED_CIDRS.length);
      env.METRICS_TOKEN = undefined;

      await app.settings.reload();

      const response = await app.inject({
        method: "GET",
        url: "/metrics",
        remoteAddress: "203.0.113.5",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message: "Forbidden" });
    } finally {
      env.METRICS_ALLOWED_CIDRS.splice(
        0,
        env.METRICS_ALLOWED_CIDRS.length,
        ...originalAllowedCidrs,
      );
      env.METRICS_TOKEN = originalToken;

      await app.settings.reload();
    }
  });
});
