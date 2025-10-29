import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

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

let buildServer: typeof import("../../server.js").buildServer;
let registerAdminRoutes: typeof import("./index.js").registerAdminRoutes;

beforeAll(async () => {
  ({ buildServer } = await import("../../server.js"));
  ({ registerAdminRoutes } = await import("./index.js"));
});

describe("admin platform routes", () => {
  let app: FastifyInstance;
  const prismaMock = {
    platform: {
      findMany: vi.fn()
    }
  } as const;

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prismaMock);
    await registerAdminRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/platforms"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns platform list for admins", async () => {
    prismaMock.platform.findMany.mockResolvedValueOnce([
      { id: "1", name: "Nintendo Entertainment System", slug: "nes", shortName: "NES" }
    ]);

    const token = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });
    const response = await app.inject({
      method: "GET",
      url: "/admin/platforms",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual({
      platforms: [
        {
          id: "1",
          name: "Nintendo Entertainment System",
          slug: "nes",
          shortName: "NES"
        }
      ]
    });
  });
});
