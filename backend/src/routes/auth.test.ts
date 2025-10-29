import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient, Role, UserInvitation, User } from "@prisma/client";
import { createHash } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.USER_INVITE_EXPIRY_HOURS = "24";

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockResolvedValue("hashed-password");
  return {
    default: {
      hash: hashMock
    }
  };
});

let buildServer: typeof import("../server.js").buildServer;

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
});

type PrismaMock = Pick<
  PrismaClient,
  "userInvitation" | "user" | "refreshToken" | "$transaction"
>;

describe("auth routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock & {
    userInvitation: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    user: {
      create: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });

    prisma = {
      userInvitation: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn()
      },
      user: {
        create: vi.fn()
      },
      refreshToken: {
        create: vi.fn()
      },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(prisma))
    } as unknown as PrismaMock & {
      userInvitation: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
      user: {
        create: ReturnType<typeof vi.fn>;
      };
      refreshToken: {
        create: ReturnType<typeof vi.fn>;
      };
      $transaction: ReturnType<typeof vi.fn>;
    };

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
    prisma.refreshToken.create.mockResolvedValueOnce({} as any);

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
    expect(typeof body.refreshToken).toBe("string");

    expect(prisma.userInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invite2" },
        data: expect.objectContaining({ redeemedAt: expect.any(Date) })
      })
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
});
