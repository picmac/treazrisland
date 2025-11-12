import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const BASE_ENV: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "0",
  JWT_SECRET: "test-secret-32-characters-minimum-value",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "30d",
  PASSWORD_RESET_TTL: "1h",
  USER_INVITE_EXPIRY_HOURS: "24",
  STORAGE_DRIVER: "filesystem",
  STORAGE_BUCKET_ASSETS: "assets",
  STORAGE_BUCKET_ROMS: "roms",
  STORAGE_BUCKET_BIOS: "bios",
  ROM_UPLOAD_MAX_BYTES: `${1024 * 1024}`,
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  TREAZ_RUNTIME_ENV: "development",
  MFA_ENCRYPTION_KEY: "test-mfa-encryption-key-should-be-long",
};

const applyEnv = (overrides: Record<string, string | undefined> = {}) => {
  for (const key of Object.keys(process.env)) {
    if (BASE_ENV[key] !== undefined) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(BASE_ENV)) {
    process.env[key] = value;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
};

const buildTestServer = async (
  overrides: Record<string, string | undefined> = {},
): Promise<FastifyInstance> => {
  vi.resetModules();
  applyEnv(overrides);

  const { buildServer } = await import("../server.js");
  const app = buildServer({ registerPrisma: false });
  await app.register(async (instance) => {
    instance.options("/cors-probe", async (_request, reply) => {
      reply.status(204).send();
    });
    instance.get("/cors-probe", async () => ({ ok: true }));
  });
  await app.ready();

  return app;
};

describe("CORS plugin LAN allowances", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("allows private network origins that reuse loopback development ports", async () => {
    app = await buildTestServer();

    const response = await app.inject({
      method: "OPTIONS",
      url: "/cors-probe",
      headers: {
        origin: "http://192.168.7.233:3000",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://192.168.7.233:3000",
    );
  });

  it("rejects LAN fallbacks in production environments", async () => {
    app = await buildTestServer({ TREAZ_RUNTIME_ENV: "production" });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/cors-probe",
      headers: {
        origin: "http://192.168.7.233:3000",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
