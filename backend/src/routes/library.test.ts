import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { RomAssetSource, RomAssetType, EnrichmentProvider } from "@prisma/client";

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
let registerLibraryRoutes: typeof import("./library.js").registerLibraryRoutes;

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
  ({ registerLibraryRoutes } = await import("./library.js"));
});

type PrismaMock = {
  platform: { findMany: ReturnType<typeof vi.fn> };
  rom: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  romAsset: { findMany: ReturnType<typeof vi.fn> };
};

describe("library routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    platform: { findMany: vi.fn() },
    rom: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    romAsset: { findMany: vi.fn() }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.platform.findMany.mockResolvedValue([]);
    prismaMock.rom.count.mockResolvedValue(0);
    prismaMock.rom.findMany.mockResolvedValue([]);
    prismaMock.romAsset.findMany.mockResolvedValue([]);
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerLibraryRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication for platform listing", async () => {
    const response = await request(app).get("/platforms");
    expect(response.status).toBe(401);
  });

  it("returns platform grid data", async () => {
    const now = new Date();
    prismaMock.platform.findMany.mockResolvedValueOnce([
      {
        id: "platform_1",
        name: "Nintendo Entertainment System",
        slug: "nes",
        shortName: "NES",
        screenscraperId: 1,
        _count: { roms: 2 },
        roms: [
          {
            id: "rom_1",
            title: "The Legend of Zelda",
            updatedAt: now,
            assets: [
              {
                id: "asset_1",
                type: RomAssetType.COVER,
                source: RomAssetSource.SCREEN_SCRAPER,
                providerId: "provider_1",
                language: "en",
                region: "us",
                width: 400,
                height: 560,
                fileSize: 12345,
                format: "png",
                checksum: "checksum",
                storageKey: "covers/rom_1.png",
                externalUrl: null,
                createdAt: now
              }
            ]
          }
        ]
      }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/platforms")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.platforms).toHaveLength(1);
    expect(response.body.platforms[0]).toMatchObject({
      id: "platform_1",
      name: "Nintendo Entertainment System",
      slug: "nes",
      romCount: 2,
      featuredRom: {
        id: "rom_1",
        title: "The Legend of Zelda"
      }
    });
    expect(prismaMock.platform.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roms: { some: {} } }),
        orderBy: { name: "asc" }
      })
    );
  });

  it("supports rom listing with filtering and sorting", async () => {
    prismaMock.rom.count.mockResolvedValueOnce(1);
    prismaMock.rom.findMany.mockResolvedValueOnce([
      {
        id: "rom_1",
        title: "Chrono Trigger",
        platformId: "platform_1",
        platform: {
          id: "platform_1",
          name: "Super Nintendo Entertainment System",
          slug: "snes",
          shortName: "SNES"
        },
        releaseYear: 1995,
        players: 1,
        romSize: 8388608,
        screenscraperId: 1234,
        romHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assets: [
          {
            id: "asset_10",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            providerId: "provider_10",
            language: "en",
            region: "us",
            width: 640,
            height: 480,
            fileSize: 2048,
            format: "jpg",
            checksum: "checksum",
            storageKey: "screenshots/asset_10.jpg",
            externalUrl: null,
            createdAt: new Date()
          }
        ],
        metadata: [
          {
            id: "meta_1",
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "us",
            summary: "Epic time-traveling adventure",
            storyline: null,
            developer: "Square",
            publisher: "Square",
            genre: "RPG",
            rating: 4.9,
            createdAt: new Date()
          }
        ]
      }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get(
        "/roms?platform=snes&search=chrono&publisher=Square&year=1995&sort=releaseYear&direction=desc&page=1&pageSize=12"
      )
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.roms[0]).toMatchObject({
      id: "rom_1",
      title: "Chrono Trigger",
      platform: { slug: "snes" },
      releaseYear: 1995
    });
    expect(prismaMock.rom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: { slug: "snes" },
          releaseYear: 1995
        }),
        orderBy: expect.arrayContaining([expect.objectContaining({ releaseYear: "desc" })]),
        take: 12
      })
    );
  });

  it("returns rom details and not found errors", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });

    prismaMock.rom.findUnique.mockResolvedValueOnce(null);
    const missingResponse = await request(app)
      .get("/roms/missing")
      .set("authorization", `Bearer ${token}`);
    expect(missingResponse.status).toBe(404);

    const now = new Date();
    prismaMock.rom.findUnique.mockResolvedValueOnce({
      id: "rom_1",
      title: "Super Mario World",
      platformId: "platform_1",
      platform: { id: "platform_1", name: "SNES", slug: "snes", shortName: "SNES" },
      releaseYear: 1991,
      players: 2,
      romSize: 5242880,
      romHash: "hash",
      screenscraperId: 42,
      createdAt: now,
      updatedAt: now,
      metadata: [],
      assets: [],
      binary: null,
      enrichmentJobs: [],
      uploadAudits: []
    });

    const detailResponse = await request(app)
      .get("/roms/rom_1")
      .set("authorization", `Bearer ${token}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toMatchObject({ id: "rom_1", title: "Super Mario World" });
  });

  it("lists rom assets and returns 404 when rom missing", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });

    prismaMock.romAsset.findMany.mockResolvedValueOnce([
      {
        id: "asset_1",
        type: RomAssetType.COVER,
        source: RomAssetSource.SCREEN_SCRAPER,
        providerId: "provider_1",
        language: "en",
        region: "us",
        width: 400,
        height: 560,
        fileSize: 12345,
        format: "png",
        checksum: "checksum",
        storageKey: "covers/rom_1.png",
        externalUrl: null,
        createdAt: new Date()
      }
    ]);

    const assetResponse = await request(app)
      .get("/roms/rom_1/assets?types=cover")
      .set("authorization", `Bearer ${token}`);
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.body.assets).toHaveLength(1);

    prismaMock.romAsset.findMany.mockResolvedValueOnce([]);
    prismaMock.rom.count.mockResolvedValueOnce(0);
    const notFound = await request(app)
      .get("/roms/unknown/assets")
      .set("authorization", `Bearer ${token}`);
    expect(notFound.status).toBe(404);
  });
});
