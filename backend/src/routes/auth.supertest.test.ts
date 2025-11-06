import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest-real";
import argon2 from "argon2";
import type { User, UserInvitation } from "@prisma/client";
import { buildServer } from "../server.js";
import { createPrismaMock, type PrismaMock } from "../test/prismaMock.js";
import { hashToken } from "../utils/tokens.js";

process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "0";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";
process.env.USER_INVITE_EXPIRY_HOURS = process.env.USER_INVITE_EXPIRY_HOURS ?? "24";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "filesystem";
process.env.STORAGE_BUCKET_ASSETS = process.env.STORAGE_BUCKET_ASSETS ?? "assets";
process.env.STORAGE_BUCKET_ROMS = process.env.STORAGE_BUCKET_ROMS ?? "roms";
process.env.STORAGE_BUCKET_BIOS = process.env.STORAGE_BUCKET_BIOS ?? "bios";
process.env.ROM_UPLOAD_MAX_BYTES = process.env.ROM_UPLOAD_MAX_BYTES ?? `${1024 * 1024}`;
process.env.MFA_ISSUER = process.env.MFA_ISSUER ?? "TREAZRISLAND";
process.env.MFA_ENCRYPTION_KEY =
  process.env.MFA_ENCRYPTION_KEY ?? "test-suite-encryption-key-32-characters";
process.env.MFA_RECOVERY_CODE_COUNT = process.env.MFA_RECOVERY_CODE_COUNT ?? "4";
process.env.MFA_RECOVERY_CODE_LENGTH = process.env.MFA_RECOVERY_CODE_LENGTH ?? "8";

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockResolvedValue("hashed-password");
  const verifyMock = vi.fn().mockResolvedValue(true);
  return {
    __esModule: true,
    default: {
      hash: hashMock,
      verify: verifyMock,
    },
  };
});

const argon2Mock = vi.mocked(argon2, true);

describe("auth flows via supertest", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    await app.ready();

    argon2Mock.hash.mockReset().mockResolvedValue("hashed-password");
    argon2Mock.verify.mockReset().mockResolvedValue(true);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("completes the signup flow and issues session cookies", async () => {
    const now = new Date();
    const token = "signup-token";

    prisma.userInvitation.findUnique.mockResolvedValueOnce({
      id: "invite-1",
      tokenHash: hashToken(token),
      tokenDigest: "$argon2id$v=19$m=65536,t=3,p=4$mock$hash",
      role: "USER",
      email: "player@example.com",
      expiresAt: new Date(now.getTime() + 60_000),
      redeemedAt: null,
      createdAt: now,
      updatedAt: now,
      createdById: "admin-1",
    } as UserInvitation);

    prisma.user.create.mockResolvedValueOnce({
      id: "user-1",
      email: "player@example.com",
      nickname: "pixelpirate",
      displayName: "pixelpirate",
      passwordHash: "hashed-password",
      role: "USER",
      createdAt: now,
      updatedAt: now,
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
      revokedReason: null,
    });
    prisma.loginAudit.create.mockResolvedValueOnce({});

    const response = await request(app.server)
      .post("/auth/signup")
      .send({
        token,
        nickname: "pixelpirate",
        password: "Secret123",
        email: "player@example.com",
      })
      .expect(201);

    expect(response.body.user).toMatchObject({
      id: "user-1",
      email: "player@example.com",
      nickname: "pixelpirate",
      role: "USER",
    });
    expect(typeof response.body.accessToken).toBe("string");
    expect(Array.isArray(response.get("set-cookie"))).toBe(true);
    expect(response.get("set-cookie").some((cookie) => cookie.includes("treaz_refresh"))).toBe(true);
    expect(prisma.userInvitation.update).toHaveBeenCalled();
  });

  it("logs in an existing user", async () => {
    const now = new Date();

    prisma.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      email: "player@example.com",
      nickname: "pixelpirate",
      passwordHash: "hashed-password",
      role: "USER",
      createdAt: now,
      updatedAt: now,
      mfaSecrets: [],
    });

    prisma.refreshTokenFamily.create.mockResolvedValueOnce({ id: "family-1" });
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token-1",
      tokenHash: "hash",
      userId: "user-1",
      familyId: "family-1",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
      revokedReason: null,
    });
    prisma.loginAudit.create.mockResolvedValueOnce({});

    const response = await request(app.server)
      .post("/auth/login")
      .send({ identifier: "player@example.com", password: "Secret123" })
      .expect(200);

    expect(response.body.user).toMatchObject({ id: "user-1", nickname: "pixelpirate" });
    expect(response.get("set-cookie").some((cookie) => cookie.includes("treaz_refresh"))).toBe(true);
    expect(prisma.loginAudit.create).toHaveBeenCalled();
  });

  it("rotates refresh tokens", async () => {
    const now = new Date();
    const refreshToken = "refresh-token";
    const hashed = hashToken(refreshToken);

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: "refresh-1",
      userId: "user-1",
      familyId: "family-1",
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      revokedReason: null,
      family: {
        id: "family-1",
        revokedAt: null,
        revokedReason: null,
      },
      user: {
        id: "user-1",
        email: "player@example.com",
        nickname: "pixelpirate",
        role: "USER",
      },
    });

    prisma.refreshToken.update.mockResolvedValueOnce({});
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token-2",
      tokenHash: "hash-new",
      userId: "user-1",
      familyId: "family-1",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 120_000),
      revokedAt: null,
      revokedReason: null,
    });

    const response = await request(app.server)
      .post("/auth/refresh")
      .set("Cookie", [`treaz_refresh=${refreshToken}`])
      .expect(200);

    expect(response.body.user).toMatchObject({ id: "user-1", nickname: "pixelpirate" });
    expect(response.get("set-cookie").some((cookie) => cookie.includes("treaz_refresh"))).toBe(true);
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashed }, include: expect.any(Object) });
  });

  it("logs out by revoking the refresh family", async () => {
    const refreshToken = "refresh-token";
    const hashed = hashToken(refreshToken);

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: "refresh-1",
      familyId: "family-1",
      userId: "user-1",
    });

    prisma.refreshTokenFamily.updateMany.mockResolvedValueOnce({});
    prisma.refreshToken.updateMany.mockResolvedValueOnce({});
    prisma.loginAudit.create.mockResolvedValueOnce({});

    await request(app.server)
      .post("/auth/logout")
      .set("Cookie", [`treaz_refresh=${refreshToken}`])
      .expect(204);

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashed }, select: expect.any(Object) });
    expect(prisma.refreshTokenFamily.updateMany).toHaveBeenCalled();
    expect(prisma.loginAudit.create).toHaveBeenCalled();
  });
});
