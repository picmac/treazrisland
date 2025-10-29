import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import type { User, UserInvitation } from "@prisma/client";
import argon2 from "argon2";

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

type MockFn = ReturnType<typeof vi.fn>;

type PrismaMock = {
  userInvitation: { findUnique: MockFn; update: MockFn; create: MockFn };
  user: { create: MockFn; findFirst: MockFn; findUnique: MockFn; update: MockFn };
  refreshTokenFamily: { create: MockFn; findMany: MockFn; updateMany: MockFn };
  refreshToken: { create: MockFn; findUnique: MockFn; update: MockFn; updateMany: MockFn };
  passwordResetToken: { create: MockFn; updateMany: MockFn; findUnique: MockFn; update: MockFn };
  loginAudit: { create: MockFn };
  mfaSecret: { update: MockFn };
  $transaction: MockFn;
};

const createPrismaMock = (): PrismaMock => {
  const prisma = {
    userInvitation: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    user: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshTokenFamily: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    loginAudit: { create: vi.fn() },
    mfaSecret: { update: vi.fn() },
    $transaction: vi.fn(async (callback: (client: PrismaMock) => Promise<any>) => callback(prisma as PrismaMock))
  } satisfies PrismaMock;

  return prisma as PrismaMock;
};

describe("auth routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    await app.ready();
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
