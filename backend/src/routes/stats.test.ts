import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { RomBinaryStatus, RomUploadStatus } from "@prisma/client";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.USER_INVITE_EXPIRY_HOURS = "24";

let buildServer: typeof import("../server.js").buildServer;
let registerStatsRoutes: typeof import("./stats.js").registerStatsRoutes;

type PrismaMock = {
  user: { count: ReturnType<typeof vi.fn> };
  rom: { count: ReturnType<typeof vi.fn> };
  romBinary: { aggregate: ReturnType<typeof vi.fn> };
  playState: {
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  romAsset: { aggregate: ReturnType<typeof vi.fn> };
  userRomFavorite: { count: ReturnType<typeof vi.fn> };
  romUploadAudit: { count: ReturnType<typeof vi.fn> };
};

describe("stats routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    user: { count: vi.fn() },
    rom: { count: vi.fn() },
    romBinary: { aggregate: vi.fn() },
    playState: { aggregate: vi.fn(), findMany: vi.fn() },
    romAsset: { aggregate: vi.fn() },
    userRomFavorite: { count: vi.fn() },
    romUploadAudit: { count: vi.fn() },
  };

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
    ({ registerStatsRoutes } = await import("./stats.js"));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.rom.count.mockResolvedValue(0);
    prismaMock.romBinary.aggregate.mockResolvedValue({ _sum: { archiveSize: 0 } });
    prismaMock.playState.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { size: 0 } });
    prismaMock.playState.findMany.mockResolvedValue([]);
    prismaMock.romAsset.aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });
    prismaMock.userRomFavorite.count.mockResolvedValue(0);
    prismaMock.romUploadAudit.count.mockResolvedValue(0);
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerStatsRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/stats/overview");
    expect(response.status).toBe(401);
  });

  it("returns aggregated stats for the current user", async () => {
    prismaMock.user.count.mockResolvedValueOnce(4);
    prismaMock.rom.count.mockResolvedValueOnce(120);
    prismaMock.romBinary.aggregate.mockResolvedValueOnce({
      _sum: { archiveSize: 1024 },
    });
    prismaMock.playState.aggregate
      .mockResolvedValueOnce({ _count: { _all: 5 }, _sum: { size: 2048 } })
      .mockResolvedValueOnce({ _count: { _all: 2 }, _sum: { size: 512 } });
    prismaMock.romAsset.aggregate.mockResolvedValueOnce({
      _sum: { fileSize: 256 },
    });
    prismaMock.userRomFavorite.count.mockResolvedValueOnce(3);
    prismaMock.romUploadAudit.count.mockResolvedValueOnce(1);
    prismaMock.playState.findMany.mockResolvedValueOnce([
      {
        rom: {
          platform: {
            id: "platform-1",
            name: "NES",
            slug: "nes",
            shortName: "NES",
          },
        },
      },
      {
        rom: {
          platform: {
            id: "platform-1",
            name: "NES",
            slug: "nes",
            shortName: "NES",
          },
        },
      },
      {
        rom: {
          platform: {
            id: "platform-2",
            name: "SNES",
            slug: "snes",
            shortName: "SNES",
          },
        },
      },
    ]);

    const token = app.jwt.sign({ sub: "user-1", role: "USER" });
    const response = await request(app)
      .get("/stats/overview")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.romBinary.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: RomBinaryStatus.READY } })
    );

    expect(response.body).toMatchObject({
      user: {
        favorites: { count: 3 },
        playStates: { count: 2, totalBytes: 512 },
        uploads: { count: 1 },
        topPlatforms: [
          { id: "platform-1", playStateCount: 2 },
          { id: "platform-2", playStateCount: 1 },
        ],
      },
      server: {
        users: 4,
        roms: 120,
        playStates: 5,
        storageBytes: {
          romBinaries: 1024,
          assets: 256,
          playStates: 2048,
          total: 3328,
        },
      },
    });
  });
});
