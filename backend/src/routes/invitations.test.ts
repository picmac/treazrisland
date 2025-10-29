import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient, Role, UserInvitation } from "@prisma/client";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.USER_INVITE_EXPIRY_HOURS = "24";

let buildServer: typeof import("../server.js").buildServer;

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
});

type PrismaMock = Pick<
  PrismaClient,
  "userInvitation"
>;

describe("invitation routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock & {
    userInvitation: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });

    prisma = {
      userInvitation: {
        create: vi.fn()
      }
    } as unknown as PrismaMock & {
      userInvitation: {
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

  const issueInvitation = async (role: Role = "ADMIN") => {
    const token = app.jwt.sign({ sub: "admin-1", role });

    return app.inject({
      method: "POST",
      url: "/users/invitations",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        email: "test@example.com",
        role: "USER",
        expiresInHours: 12
      }
    });
  };

  it("requires authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users/invitations",
      payload: {
        email: "test@example.com"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects non-admin users", async () => {
    const response = await issueInvitation("USER");
    expect(response.statusCode).toBe(403);
  });

  it("creates an invitation token for admins", async () => {
    const before = Date.now();

    prisma.userInvitation.create.mockImplementationOnce(async ({ data }) => {
      return {
        id: "invite_1",
        tokenHash: data.tokenHash,
        role: data.role,
        email: data.email,
        expiresAt: data.expiresAt,
        redeemedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: data.createdById
      } satisfies UserInvitation;
    });

    const response = await issueInvitation();

    expect(response.statusCode).toBe(201);
    const body = await response.json();

    expect(typeof body.token).toBe("string");
    expect(body.invitation).toMatchObject({
      id: "invite_1",
      role: "USER",
      email: "test@example.com"
    });
    const expiresAt = new Date(body.invitation.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(before);
    expect(expiresAt - before).toBeLessThanOrEqual(12 * 60 * 60 * 1000 + 1000);

    expect(prisma.userInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "test@example.com",
          role: "USER",
          createdById: "admin-1"
        })
      })
    );
  });
});
