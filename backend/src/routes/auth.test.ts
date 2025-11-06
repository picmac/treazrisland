import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import type { User, UserInvitation } from "@prisma/client";
import argon2 from "argon2";
import type { MfaService } from "../services/mfa/service.js";
import { createPrismaMock, type PrismaMock } from "../test/prismaMock.js";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
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

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockResolvedValue("hashed-password");
  const verifyMock = vi.fn().mockResolvedValue(true);
  return {
    __esModule: true,
    default: {
      hash: hashMock,
      verify: verifyMock
    }
  };
});

const argon2Mock = vi.mocked(argon2, true);

let buildServer: typeof import("../server.js").buildServer;

describe("auth routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;
  let mfaService: MfaService;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    mfaService = {
      generateSecret: vi.fn().mockReturnValue("JBSWY3DPEHPK3PXP"),
      buildOtpAuthUri: vi.fn().mockReturnValue("otpauth://totp/TREAZRISLAND:player?secret=JBSWY3DPEHPK3PXP"),
      verifyTotp: vi.fn().mockResolvedValue(true),
      findMatchingRecoveryCode: vi.fn().mockResolvedValue(null),
      encryptSecret: vi.fn().mockImplementation((value: string) => `encrypted-${value}`),
      decryptSecret: vi
        .fn()
        .mockReturnValue({ secret: "JBSWY3DPEHPK3PXP", needsRotation: false })
    } satisfies MfaService;
    await app.ready();
    app.mfaService = mfaService;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

  it("returns 404 for invalid invitation preview", async () => {
    prisma.userInvitation.findUnique.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "POST",
      url: "/auth/invitations/preview",
      payload: { token: "invalid" }
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns invitation details for valid preview", async () => {
    const token = "valid-token";
    prisma.userInvitation.findUnique.mockResolvedValueOnce({
      id: "invite1",
      tokenHash: hashToken(token),
      tokenDigest: "$argon2id$v=19$m=65536,t=3,p=4$mock$hash",
      role: "USER",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: "admin-1"
    } as UserInvitation);

    const response = await app.inject({
      method: "POST",
      url: "/auth/invitations/preview",
      payload: { token }
    });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual({
      invitation: {
        role: "USER",
        email: "guest@example.com"
      }
    });
  });

  it("creates a user from invitation during signup", async () => {
    const token = "signup-token";
    const now = new Date();

    prisma.userInvitation.findUnique.mockResolvedValueOnce({
      id: "invite2",
      tokenHash: hashToken(token),
      tokenDigest: "$argon2id$v=19$m=65536,t=3,p=4$mock$hash",
      role: "USER",
      email: "newplayer@example.com",
      expiresAt: new Date(now.getTime() + 60_000),
      redeemedAt: null,
      createdAt: now,
      updatedAt: now,
      createdById: "admin-2"
    } as UserInvitation);

    prisma.user.create.mockResolvedValueOnce({
      id: "user-1",
      email: "newplayer@example.com",
      nickname: "pixelpirate",
      displayName: "pixelpirate",
      role: "USER",
      passwordHash: "hashed-password",
      createdAt: now,
      updatedAt: now
    } as User);

    prisma.userInvitation.update.mockResolvedValueOnce({} as UserInvitation);
    prisma.refreshTokenFamily.create.mockResolvedValueOnce({ id: "family-1" });
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token-1",
      tokenHash: "hash",
      userId: "user-1",
      familyId: "family-1",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
      revokedReason: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        token,
        nickname: "pixelpirate",
        password: "Secret123",
        email: "newplayer@example.com"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = await response.json();
    expect(body.user).toMatchObject({
      id: "user-1",
      email: "newplayer@example.com",
      nickname: "pixelpirate",
      role: "USER"
    });
    expect(typeof body.accessToken).toBe("string");
    expect(body.refreshToken).toBeUndefined();
    expect(response.headers["set-cookie"]).toContain("HttpOnly");

    expect(prisma.userInvitation.update).toHaveBeenCalled();
    expect(prisma.refreshTokenFamily.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: "user-1" } })
    );
  });

  it("rejects signup when email mismatches invitation", async () => {
    const token = "wrong-email";
    prisma.userInvitation.findUnique.mockResolvedValueOnce({
      id: "invite3",
      tokenHash: hashToken(token),
      tokenDigest: "$argon2id$v=19$m=65536,t=3,p=4$mock$hash",
      role: "USER",
      email: "locked@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: "admin-3"
    } as UserInvitation);

    const response = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        token,
        nickname: "voyager",
        password: "Secret123",
        email: "different@example.com"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(await response.json()).toEqual({ message: "Email does not match invitation" });
  });

  it("creates an MFA setup bundle", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-setup",
      email: "player@example.com",
      nickname: "player"
    });
    prisma.mfaSecret.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.mfaSecret.create.mockResolvedValueOnce({ id: "secret-setup" });

    const token = app.jwt.sign({ sub: "user-setup", role: "USER" });
    const response = await app.inject({
      method: "POST",
      url: "/auth/mfa/setup",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = await response.json();
    expect(body.secretId).toBe("secret-setup");
    expect(body.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(Array.isArray(body.recoveryCodes)).toBe(true);
    expect(body.recoveryCodes).toHaveLength(4);

    expect(prisma.mfaSecret.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-setup", confirmedAt: null }
    });
    expect(prisma.mfaSecret.create).toHaveBeenCalledWith({
      data: {
        userId: "user-setup",
        secret: "encrypted-JBSWY3DPEHPK3PXP",
        recoveryCodes: expect.stringContaining("hashed-password")
      }
    });
    expect(mfaService.encryptSecret).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(mfaService.buildOtpAuthUri).toHaveBeenCalledWith({
      issuer: "TREAZRISLAND",
      label: "player@example.com",
      secret: "JBSWY3DPEHPK3PXP"
    });
  });

  it("confirms MFA setup", async () => {
    prisma.mfaSecret.findFirst.mockResolvedValueOnce({
      id: "secret-setup",
      userId: "user-setup",
      secret: "encrypted-JBSWY3DPEHPK3PXP",
      recoveryCodes: "",
      confirmedAt: null,
      disabledAt: null
    });
    prisma.mfaSecret.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.mfaSecret.update.mockResolvedValueOnce({ id: "secret-setup" });

    const token = app.jwt.sign({ sub: "user-setup", role: "USER" });
    const response = await app.inject({
      method: "POST",
      url: "/auth/mfa/confirm",
      headers: { authorization: `Bearer ${token}` },
      payload: { secretId: "secret-setup", code: "123456" }
    });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual({
      message: "Multi-factor authentication enabled"
    });
    expect(mfaService.decryptSecret).toHaveBeenCalledWith(
      "encrypted-JBSWY3DPEHPK3PXP"
    );
    expect(mfaService.verifyTotp).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", "123456");
    expect(prisma.mfaSecret.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-setup",
        disabledAt: null,
        confirmedAt: { not: null }
      },
      data: { disabledAt: expect.any(Date) }
    });
    expect(prisma.mfaSecret.update).toHaveBeenCalledWith({
      where: { id: "secret-setup" },
      data: expect.objectContaining({ confirmedAt: expect.any(Date) })
    });
  });

  it("re-encrypts legacy MFA secrets during confirmation", async () => {
    prisma.mfaSecret.findFirst.mockResolvedValueOnce({
      id: "legacy-secret",
      userId: "user-setup",
      secret: "legacy-secret-value",
      recoveryCodes: "",
      confirmedAt: null,
      disabledAt: null
    });
    prisma.mfaSecret.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.mfaSecret.update.mockResolvedValueOnce({ id: "legacy-secret" });
    mfaService.decryptSecret = vi
      .fn()
      .mockReturnValue({ secret: "JBSWY3DPEHPK3PXP", needsRotation: true });

    const token = app.jwt.sign({ sub: "user-setup", role: "USER" });
    const response = await app.inject({
      method: "POST",
      url: "/auth/mfa/confirm",
      headers: { authorization: `Bearer ${token}` },
      payload: { secretId: "legacy-secret", code: "123456" }
    });

    expect(response.statusCode).toBe(200);
    expect(mfaService.encryptSecret).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(prisma.mfaSecret.update).toHaveBeenCalledWith({
      where: { id: "legacy-secret" },
      data: expect.objectContaining({
        secret: "encrypted-JBSWY3DPEHPK3PXP",
        confirmedAt: expect.any(Date)
      })
    });
  });

  it("disables MFA with a valid code", async () => {
    prisma.mfaSecret.findFirst.mockResolvedValueOnce({
      id: "secret-active",
      userId: "user-setup",
      secret: "encrypted-JBSWY3DPEHPK3PXP",
      recoveryCodes: "hashed-one\nhashed-two",
      confirmedAt: new Date("2025-01-01T00:00:00Z"),
      disabledAt: null
    });
    prisma.mfaSecret.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.mfaSecret.deleteMany.mockResolvedValueOnce({ count: 0 });

    const token = app.jwt.sign({ sub: "user-setup", role: "USER" });
    const response = await app.inject({
      method: "POST",
      url: "/auth/mfa/disable",
      headers: { authorization: `Bearer ${token}` },
      payload: { mfaCode: "123456" }
    });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual({
      message: "Multi-factor authentication disabled"
    });
    expect(mfaService.decryptSecret).toHaveBeenCalledWith(
      "encrypted-JBSWY3DPEHPK3PXP"
    );
    expect(mfaService.verifyTotp).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", "123456");
    expect(prisma.mfaSecret.update).not.toHaveBeenCalled();
    expect(prisma.mfaSecret.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-setup", disabledAt: null },
      data: { disabledAt: expect.any(Date) }
    });
    expect(prisma.mfaSecret.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-setup", confirmedAt: null }
    });
  });

  it("logs in and sets refresh cookie", async () => {
    const now = new Date();
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "user-2",
      email: "player@example.com",
      nickname: "player",
      passwordHash: "hashed-password",
      role: "USER",
      createdAt: now,
      updatedAt: now,
      mfaSecrets: []
    });

    prisma.refreshTokenFamily.create.mockResolvedValueOnce({ id: "family-login" });
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token-login",
      tokenHash: "hash",
      userId: "user-2",
      familyId: "family-login",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
      revokedReason: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        identifier: "player@example.com",
        password: "Secret123"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({ id: "user-2", email: "player@example.com" });
    expect(typeof body.accessToken).toBe("string");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(prisma.loginAudit.create).toHaveBeenCalled();
  });

  it("rejects login with invalid password", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "user-3",
      email: "player@example.com",
      nickname: "player",
      passwordHash: "hashed-password",
      role: "USER",
      mfaSecrets: []
    });
    argon2Mock.verify.mockResolvedValueOnce(false);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        identifier: "player@example.com",
        password: "BadSecret"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(prisma.loginAudit.create).toHaveBeenCalled();
  });

  it("refreshes tokens when provided a valid cookie", async () => {
    const now = new Date();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: "token-old",
      userId: "user-4",
      familyId: "family-4",
      tokenHash: hashToken("refresh-token"),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      revokedReason: null,
      family: { id: "family-4", revokedAt: null, revokedReason: null },
      user: { id: "user-4", email: "u4@example.com", nickname: "u4", role: "USER" }
    });
    prisma.refreshToken.update.mockResolvedValueOnce({});
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token-new",
      tokenHash: "hash-new",
      userId: "user-4",
      familyId: "family-4",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 120_000),
      revokedAt: null,
      revokedReason: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: "treaz_refresh=refresh-token"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({ id: "user-4" });
    expect(response.headers["set-cookie"]).toContain("treaz_refresh=");
  });

  it("clears cookie on logout and revokes family", async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: "token-old",
      userId: "user-5",
      familyId: "family-5"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: "treaz_refresh=logout-token"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(prisma.refreshTokenFamily.updateMany).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });
});
