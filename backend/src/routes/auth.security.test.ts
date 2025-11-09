import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import argon2 from "argon2";
import type { MfaService } from "../services/mfa/service.js";

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

vi.mock("argon2", () => {
  const hashMock = vi.fn(async (value: string) => `hashed-${value}`);
  const verifyMock = vi.fn(async () => true);
  return {
    __esModule: true,
    default: {
      hash: hashMock,
      verify: verifyMock,
    },
  } satisfies typeof import("argon2");
});

const argon2Mock = vi.mocked(argon2, true);

let buildServer: typeof import("../server.js").buildServer;

type PrismaMock = {
  user: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  loginAudit: { create: ReturnType<typeof vi.fn> };
  mfaSecret: {
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshTokenFamily: { create: ReturnType<typeof vi.fn> };
  refreshToken: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const createPrismaMock = (): PrismaMock => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
  loginAudit: { create: vi.fn().mockResolvedValue({}) },
  mfaSecret: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshTokenFamily: { create: vi.fn().mockResolvedValue({ id: "family-1" }) },
  refreshToken: { create: vi.fn().mockResolvedValue({ id: "token-1" }) },
  $transaction: vi.fn(),
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
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.mfaSecret.create.mockResolvedValue({ id: "secret-123" });
    prisma.mfaSecret.update.mockResolvedValue({ id: "secret-123" });
    prisma.$transaction.mockImplementation(async (callback: (client: PrismaMock) => Promise<unknown>) =>
      callback({
        mfaSecret: prisma.mfaSecret,
        refreshTokenFamily: prisma.refreshTokenFamily,
        refreshToken: prisma.refreshToken,
      } as unknown as PrismaMock),
    );

    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    await app.ready();

    const mfaService: MfaService = {
      generateSecret: vi.fn().mockReturnValue("JBSWY3DPEHPK3PXP"),
      buildOtpAuthUri: vi
        .fn()
        .mockImplementation(({ issuer, label, secret }) =>
          `otpauth://totp/${issuer}:${label}?secret=${secret}`,
        ),
      verifyTotp: vi.fn(),
      findMatchingRecoveryCode: vi.fn(),
      encryptSecret: vi.fn((value: string) => `encrypted-${value}`),
      decryptSecret: vi
        .fn()
        .mockReturnValue({ secret: "JBSWY3DPEHPK3PXP", needsRotation: false }),
    };
    app.mfaService = mfaService;
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

  it("prepares encrypted secrets and hashed recovery codes during MFA enrollment", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-123",
      email: "player@example.com",
      nickname: "pixelpirate",
    });

    const token = app.jwt.sign({ sub: "user-123", role: "USER" });

    const response = await request(app)
      .post("/auth/mfa/setup")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.secretId).toBe("secret-123");
    expect(response.body.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(response.body.otpauthUri).toBe(
      "otpauth://totp/TREAZRISLAND:player@example.com?secret=JBSWY3DPEHPK3PXP",
    );
    expect(Array.isArray(response.body.recoveryCodes)).toBe(true);
    const expectedCount = Number(process.env.MFA_RECOVERY_CODE_COUNT ?? "0");
    expect(response.body.recoveryCodes).toHaveLength(expectedCount);

    const hashedValues = (response.body.recoveryCodes as string[]).map(
      (code: string) => `hashed-${code}`,
    );
    expect(argon2Mock.hash).toHaveBeenCalledTimes(expectedCount);
    expect(prisma.mfaSecret.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-123", confirmedAt: null },
    });
    expect(prisma.mfaSecret.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-123",
        secret: "encrypted-JBSWY3DPEHPK3PXP",
        recoveryCodes: hashedValues.join("\n"),
      }),
    });
  });

  it("rejects MFA enrollment attempts without an authenticated principal", async () => {
    const response = await request(app)
      .post("/auth/mfa/setup")
      .set("authorization", "Bearer orphan");

    expect(response.status).toBe(401);
    expect(prisma.mfaSecret.create).not.toHaveBeenCalled();
  });

  it("enforces MFA challenges before issuing session tokens", async () => {
    const now = new Date("2025-02-28T00:00:00Z");
    const activeSecret = {
      id: "secret-active",
      userId: "user-123",
      secret: "encrypted-JBSWY3DPEHPK3PXP",
      recoveryCodes: "hashed-one\nhashed-two",
      confirmedAt: now,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    prisma.user.findFirst.mockResolvedValue({
      id: "user-123",
      email: "player@example.com",
      nickname: "pixelpirate",
      role: "USER",
      passwordHash: "argon2-hash",
      mfaSecrets: [activeSecret],
    });

    const mfaService = app.mfaService as MfaService;
    mfaService.decryptSecret = vi.fn().mockReturnValue({
      secret: "JBSWY3DPEHPK3PXP",
      needsRotation: false,
    });
    mfaService.verifyTotp = vi.fn().mockResolvedValue(true);

    argon2Mock.verify.mockResolvedValue(true);

    const initialChallenge = await request(app)
      .post("/auth/login")
      .send({ identifier: "player@example.com", password: "Secret123" });

    expect(initialChallenge.status).toBe(401);
    expect(initialChallenge.body).toEqual({
      message: "MFA challenge required",
      mfaRequired: true,
    });
    expect(prisma.loginAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event: "MFA_REQUIRED" }),
    });

    const sessionResponse = await request(app)
      .post("/auth/login")
      .send({
        identifier: "player@example.com",
        password: "Secret123",
        mfaCode: "123456",
      });

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      user: {
        id: "user-123",
        email: "player@example.com",
        nickname: "pixelpirate",
        role: "USER",
      },
      accessToken: expect.any(String),
      refreshExpiresAt: expect.any(String),
    });

    expect(mfaService.verifyTotp).toHaveBeenCalledWith(
      "JBSWY3DPEHPK3PXP",
      "123456",
    );
    expect(prisma.refreshTokenFamily.create).toHaveBeenCalledWith({
      data: { userId: "user-123" },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-123" }),
    });
  });
});
