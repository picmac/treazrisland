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
let registerCollectionRoutes: typeof import("./collections.js").registerCollectionRoutes;

type PrismaMock = {
  romCollection: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
  ({ registerCollectionRoutes } = await import("./collections.js"));
});

describe("collection routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    romCollection: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.romCollection.findMany.mockResolvedValue([]);
    prismaMock.romCollection.findFirst.mockResolvedValue(null);
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerCollectionRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication for listing", async () => {
    const response = await request(app).get("/collections");
    expect(response.status).toBe(401);
  });

  it("lists published collections", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const updatedAt = new Date("2025-02-01T00:00:00Z");
    prismaMock.romCollection.findMany.mockResolvedValueOnce([
      {
        id: "collection_1",
        slug: "essentials",
        title: "Treaz Essentials",
        description: "Must-play picks",
        isPublished: true,
        createdAt,
        updatedAt,
        createdById: "user_admin",
        items: [
          {
            id: "item_1",
            collectionId: "collection_1",
            romId: "rom_1",
            position: 1,
            note: "Kick-off",
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
      .get("/collections")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.collections).toHaveLength(1);
    expect(response.body.collections[0]).toMatchObject({
      slug: "essentials",
      roms: [
        {
          id: "rom_1",
          title: "Chrono Trigger",
          position: 1,
          platform: {
            id: "platform_snes",
            slug: "snes"
          }
        }
      ]
    });
    expect(prismaMock.romCollection.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      include: expect.any(Object)
    });
  });

  it("validates slug when fetching a collection", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/collections/%20")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("returns 404 when collection is missing", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/collections/unknown")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("returns collection details by slug", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const updatedAt = new Date("2025-02-01T00:00:00Z");
    prismaMock.romCollection.findFirst.mockResolvedValueOnce({
      id: "collection_1",
      slug: "essentials",
      title: "Treaz Essentials",
      description: "Must-play picks",
      isPublished: true,
      createdAt,
      updatedAt,
      createdById: "user_admin",
      items: [
        {
          id: "item_1",
          collectionId: "collection_1",
          romId: "rom_1",
          position: 1,
          note: null,
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
      .get("/collections/essentials")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.collection).toMatchObject({
      slug: "essentials",
      roms: [
        {
          id: "rom_1",
          position: 1
        }
      ]
    });
    expect(prismaMock.romCollection.findFirst).toHaveBeenCalledWith({
      where: { slug: "essentials", isPublished: true },
      include: expect.any(Object)
    });
  });
});
