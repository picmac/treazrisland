import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";

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

let buildServer: typeof import("../../src/server.js").buildServer;
let registerLibraryRoutes: typeof import("../../src/routes/library/index.js").registerLibraryRoutes;

type PrismaMock = {
  platform: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  rom: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  romAsset: { findMany: ReturnType<typeof vi.fn> };
};

describe("library integration routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    platform: { findMany: vi.fn(), findUnique: vi.fn() },
    rom: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    romAsset: { findMany: vi.fn() }
  };

  beforeAll(async () => {
    ({ buildServer } = await import("../../src/server.js"));
    ({ registerLibraryRoutes } = await import("../../src/routes/library/index.js"));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.platform.findMany.mockResolvedValue([]);
    prismaMock.platform.findUnique.mockResolvedValue(null);
    prismaMock.rom.count.mockResolvedValue(0);
    prismaMock.rom.findMany.mockResolvedValue([]);
    prismaMock.rom.findUnique.mockResolvedValue(null);
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

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/platforms");
    expect(response.status).toBe(401);
  });

  it("applies filters and pagination when listing roms", async () => {
    const now = new Date();
    prismaMock.rom.count.mockResolvedValueOnce(1);
    prismaMock.rom.findMany.mockResolvedValueOnce([
      {
        id: "rom_1",
        title: "The Legend of Zelda",
        platform: {
          id: "platform_1",
          name: "Nintendo Entertainment System",
          slug: "nes",
          shortName: "NES"
        },
        releaseYear: 1986,
        players: 1,
        romSize: 123456,
        romHash: "hash",
        screenscraperId: 734,
        createdAt: now,
        updatedAt: now,
        metadata: [
          {
            id: "meta_1",
            source: "SCREEN_SCRAPER",
            language: "en",
            region: "USA",
            summary: "summary",
            developer: "Nintendo",
            publisher: "Nintendo",
            genre: "Adventure",
            rating: 4.5,
            createdAt: now
          }
        ],
        assets: [
          {
            id: "asset_1",
            type: "COVER",
            source: "SCREEN_SCRAPER",
            providerId: "provider_1",
            language: "en",
            region: "USA",
            width: 400,
            height: 560,
            fileSize: 1000,
            format: "png",
            checksum: "checksum",
            storageKey: "covers/rom_1.png",
            externalUrl: null,
            createdAt: now
          }
        ]
      }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/roms?platform=nes&search=zelda&year=1986&page=2&pageSize=10")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.roms).toHaveLength(1);
    expect(prismaMock.rom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: { slug: "nes" },
          OR: expect.any(Array),
          releaseYear: 1986
        }),
        skip: 10,
        take: 10
      })
    );
  });

  it("enforces library rate limits", async () => {
    prismaMock.platform.findMany.mockResolvedValue([
      {
        id: "platform_1",
        name: "Nintendo Entertainment System",
        slug: "nes",
        shortName: "NES",
        screenscraperId: 1,
        _count: { roms: 0 },
        creativeAssetUsages: [],
        roms: []
      }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    for (let index = 0; index < 60; index += 1) {
      const response = await request(app)
        .get("/platforms")
        .set("authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
    }

    const limited = await request(app)
      .get("/platforms")
      .set("authorization", `Bearer ${token}`);

    expect(limited.status).toBe(429);
  });
});
