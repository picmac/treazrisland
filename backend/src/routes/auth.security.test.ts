import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
process.env.MFA_ENCRYPTION_KEY = "test-suite-encryption-key-32-characters";
process.env.MFA_RECOVERY_CODE_COUNT = "4";
process.env.MFA_RECOVERY_CODE_LENGTH = "8";
process.env.RATE_LIMIT_AUTH_POINTS = "3";
process.env.RATE_LIMIT_AUTH_DURATION = "60";

let buildServer: typeof import("../server.js").buildServer;

type PrismaMock = {
  user: { findFirst: ReturnType<typeof vi.fn> };
  loginAudit: { create: ReturnType<typeof vi.fn> };
};

const createPrismaMock = (): PrismaMock => ({
  user: { findFirst: vi.fn() },
  loginAudit: { create: vi.fn().mockResolvedValue({}) },
});

const credentialPayload = {
  identifier: "player@example.com",
  password: "incorrect-password",
};

describe("authentication hardening scenarios", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);

    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("enforces the configured rate limit on /auth/login", async () => {
    const attempts = [] as number[];

    for (let index = 0; index < 3; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: credentialPayload,
      });
      attempts.push(response.statusCode);
    }

    const limited = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: credentialPayload,
    });

    expect(attempts.every((code) => code === 401)).toBe(true);
    expect(limited.statusCode).toBe(429);
  });

  it("captures IP and user agent in login audit records during lockout drills", async () => {
    const headers = { "user-agent": "VitestLockout/1.0" };
    const remoteAddress = "203.0.113.45";

    for (let index = 0; index < 2; index += 1) {
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: credentialPayload,
        headers,
        remoteAddress,
      });
    }

    expect(prisma.loginAudit.create).toHaveBeenCalledTimes(2);
    for (const call of prisma.loginAudit.create.mock.calls) {
      expect(call[0]).toEqual({
        data: expect.objectContaining({
          ipAddress: remoteAddress,
          userAgent: headers["user-agent"],
          event: "FAILURE",
        }),
      });
    }
  });
});
