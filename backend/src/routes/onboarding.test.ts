import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockResolvedValue("hashed-password");
  return {
    default: {
      hash: hashMock
    }
  };
});

process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "0";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";
process.env.USER_INVITE_EXPIRY_HOURS = process.env.USER_INVITE_EXPIRY_HOURS ?? "24";

let buildServer: typeof import("../server.js").buildServer;

type PrismaMock = Pick<PrismaClient, "user" | "refreshToken">;

describe("onboarding routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock & {
    user: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.resetModules();
    ({ buildServer } = await import("../server.js"));
    app = buildServer({ registerPrisma: false });

    prisma = {
      user: {
        count: vi.fn(),
        create: vi.fn()
      },
      refreshToken: {
        create: vi.fn()
      }
    } as unknown as PrismaMock & {
      user: {
        count: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
      refreshToken: {
        create: ReturnType<typeof vi.fn>;
      };
    };

    app.decorate("prisma", prisma);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("reports needsSetup=true when there are no users", async () => {
    prisma.user.count.mockResolvedValueOnce(0);

    const response = await app.inject({
      method: "GET",
      url: "/onboarding/status"
    });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual({ needsSetup: true });
  });

  it("creates initial admin and issues tokens", async () => {
    prisma.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const now = new Date();
    prisma.user.create.mockResolvedValueOnce({
      id: "user_1",
      email: "admin@example.com",
      nickname: "captain",
      displayName: "captain",
      passwordHash: "hash",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now
    });
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: "token_1",
      tokenHash: "hash",
      userId: "user_1",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/admin",
      payload: {
        email: "admin@example.com",
        nickname: "captain",
        password: "Secret123"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = await response.json();

    expect(body.user).toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      nickname: "captain",
      role: "ADMIN"
    });
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");

    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          tokenHash: expect.any(String)
        })
      })
    );
  });
});
