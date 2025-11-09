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
process.env.TREAZ_TLS_MODE = "https";

let buildServer: typeof import("../server.js").buildServer;

describe("HTTPS enforcement middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });
    await app.register(async (instance) => {
      instance.get("/secure", async () => ({ ok: true }));
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects non-TLS requests forwarded from untrusted origins", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: {
        host: "api.treazris.land",
        "x-forwarded-proto": "http",
      },
      remoteAddress: "198.51.100.44",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "HTTPS is required for this endpoint",
    });
  });

  it("allows local or TLS-forwarded requests", async () => {
    const localResponse = await app.inject({ method: "GET", url: "/secure" });
    expect(localResponse.statusCode).toBe(200);

    const forwardedResponse = await app.inject({
      method: "GET",
      url: "/secure",
      headers: {
        host: "api.treazris.land",
        "x-forwarded-proto": "https",
      },
      remoteAddress: "203.0.113.20",
    });

    expect(forwardedResponse.statusCode).toBe(200);
  });
});
