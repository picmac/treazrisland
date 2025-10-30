import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

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

let buildServer: typeof import("../server.js").buildServer;
let registerTopListRoutes: typeof import("./topLists.js").registerTopListRoutes;

type PrismaMock = {
  romTopList: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
  ({ registerTopListRoutes } = await import("./topLists.js"));
});

describe("top list routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    romTopList: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.romTopList.findMany.mockResolvedValue([]);
    prismaMock.romTopList.findFirst.mockResolvedValue(null);
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerTopListRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication for listing", async () => {
    const response = await request(app).get("/top-lists");
    expect(response.status).toBe(401);
  });

  it("returns published top lists", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const updatedAt = new Date("2025-02-01T00:00:00Z");
    const publishedAt = new Date("2025-02-15T00:00:00Z");
    prismaMock.romTopList.findMany.mockResolvedValueOnce([
      {
        id: "top_1",
        slug: "february-legends",
        title: "February Legends",
        description: "Community favorites",
        publishedAt,
        effectiveFrom: new Date("2025-02-01T00:00:00Z"),
        effectiveTo: new Date("2025-02-28T00:00:00Z"),
        createdAt,
        updatedAt,
        createdById: "user_admin",
        entries: [
          {
            id: "entry_1",
            topListId: "top_1",
            romId: "rom_1",
            rank: 1,
            blurb: "Chrono adventure",
            createdAt,
            rom: {
              id: "rom_1",
              title: "Chrono Trigger",
              platform: {
                id: "platform_snes",
                name: "Super Nintendo",
                slug: "snes",
                shortName: "SNES"
              }
            }
          }
        ]
      }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/top-lists")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.topLists).toHaveLength(1);
    expect(response.body.topLists[0]).toMatchObject({
      slug: "february-legends",
      entries: [
        {
          romId: "rom_1",
          title: "Chrono Trigger",
          rank: 1
        }
      ]
    });
    expect(prismaMock.romTopList.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: expect.any(Object)
    });
  });

  it("validates slug when fetching a top list", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/top-lists/%20")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("returns 404 when top list is missing", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/top-lists/missing")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("returns top list details by slug", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const updatedAt = new Date("2025-02-01T00:00:00Z");
    const publishedAt = new Date("2025-02-15T00:00:00Z");
    prismaMock.romTopList.findFirst.mockResolvedValueOnce({
      id: "top_1",
      slug: "february-legends",
      title: "February Legends",
      description: "Community favorites",
      publishedAt,
      effectiveFrom: new Date("2025-02-01T00:00:00Z"),
      effectiveTo: new Date("2025-02-28T00:00:00Z"),
      createdAt,
      updatedAt,
      createdById: "user_admin",
      entries: [
        {
          id: "entry_1",
          topListId: "top_1",
          romId: "rom_1",
          rank: 1,
          blurb: null,
          createdAt,
          rom: {
            id: "rom_1",
            title: "Chrono Trigger",
            platform: {
              id: "platform_snes",
              name: "Super Nintendo",
              slug: "snes",
              shortName: "SNES"
            }
          }
        }
      ]
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/top-lists/february-legends")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.topList).toMatchObject({
      slug: "february-legends",
      entries: [
        {
          romId: "rom_1",
          rank: 1
        }
      ]
    });
    expect(prismaMock.romTopList.findFirst).toHaveBeenCalledWith({
      where: { slug: "february-legends", publishedAt: { not: null } },
      include: expect.any(Object)
    });
  });
});
