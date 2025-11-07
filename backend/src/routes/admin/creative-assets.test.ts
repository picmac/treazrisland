import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

let buildServer: typeof import("../../server.js").buildServer;
let registerCreativeAssetRoutes: typeof import("./creative-assets.js").registerCreativeAssetRoutes;

beforeAll(async () => {
  ({ buildServer } = await import("../../server.js"));
  ({ registerCreativeAssetRoutes } = await import("./creative-assets.js"));
});

const creativeAssetId = "ckopqsk4c00003m5w1h4j7s7b";
const creativeAssetUsageId = "ckopqsk4c00013m5w1h4j7s7c";
const platformId = "ckopqsk4c00023m5w1h4j7s7d";

type PrismaMock = {
  creativeAsset: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  creativeAssetUsage: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  creativeAssetAudit: {
    create: ReturnType<typeof vi.fn>;
  };
  platform: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const createTransactionShim = (mock: PrismaMock) =>
  async <T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> => {
    const tx = {
      creativeAsset: {
        create: mock.creativeAsset.create,
        findUnique: mock.creativeAsset.findUnique,
        update: mock.creativeAsset.update,
        delete: mock.creativeAsset.delete
      },
      creativeAssetUsage: {
        create: mock.creativeAssetUsage.create,
        deleteMany: mock.creativeAssetUsage.deleteMany,
        delete: mock.creativeAssetUsage.delete,
        findUnique: mock.creativeAssetUsage.findUnique
      },
      creativeAssetAudit: {
        create: mock.creativeAssetAudit.create
      },
      platform: {
        findUnique: mock.platform.findUnique
      }
    } as unknown as PrismaClient;

    return callback(tx);
  };

describe("admin creative asset routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    creativeAsset: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    creativeAssetUsage: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn()
    },
    creativeAssetAudit: {
      create: vi.fn()
    },
    platform: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });

    prismaMock.$transaction.mockImplementation(createTransactionShim(prismaMock));

    app.decorate("prisma", prismaMock as unknown as PrismaClient);

    await app.register(async (instance) => {
      instance.addHook("preHandler", async (request, reply) => {
        await instance.requireAdmin(request, reply);
      });
      await registerCreativeAssetRoutes(instance);
    }, { prefix: "/admin" });

    await app.ready();

    app.metrics.enabled = false;

    const storage = app.storage as unknown as {
      putObject: ReturnType<typeof vi.fn>;
      deleteAssetObject: ReturnType<typeof vi.fn>;
      getAssetObjectSignedUrl: ReturnType<typeof vi.fn>;
    };
    storage.putObject = vi.fn().mockResolvedValue(undefined);
    storage.deleteAssetObject = vi.fn().mockResolvedValue(undefined);
    storage.getAssetObjectSignedUrl = vi.fn().mockResolvedValue(null);
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates curated assets and assigns platform hero usage", async () => {
    const now = new Date();
    prismaMock.platform.findUnique.mockResolvedValueOnce({
      id: platformId,
      slug: "snes"
    });
    prismaMock.creativeAsset.create.mockResolvedValueOnce({
      id: creativeAssetId,
      slug: "snes-hero"
    });
    prismaMock.creativeAssetUsage.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.creativeAssetUsage.create.mockResolvedValueOnce({
      id: creativeAssetUsageId,
      kind: "PLATFORM_HERO",
      targetKey: `platform:${platformId}`,
      platformId,
      notes: "SNES hero",
      createdAt: now,
      updatedAt: now,
      platform: {
        id: platformId,
        slug: "snes",
        name: "Super Nintendo",
        shortName: "SNES"
      }
    });
    prismaMock.creativeAssetAudit.create.mockResolvedValue({ id: "audit" });
    prismaMock.creativeAsset.findUnique.mockResolvedValueOnce({
      id: creativeAssetId,
      slug: "snes-hero",
      title: "Super Nintendo Hero",
      description: null,
      kind: "HERO",
      status: "ACTIVE",
      originalFilename: "snes.png",
      storageKey: "creative-assets/snes-hero/hero.png",
      mimeType: "image/png",
      width: 640,
      height: 360,
      fileSize: 1024,
      checksumSha256: "abc",
      checksumSha1: "def",
      checksumMd5: "ghi",
      createdAt: now,
      updatedAt: now,
      signedUrl: null,
      signedUrlExpiresAt: null,
      usages: [
        {
          id: creativeAssetUsageId,
          kind: "PLATFORM_HERO",
          targetKey: `platform:${platformId}`,
          notes: "SNES hero",
          createdAt: now,
          updatedAt: now,
          platform: {
            id: platformId,
            slug: "snes",
            name: "Super Nintendo",
            shortName: "SNES"
          }
        }
      ]
    });

    const token = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });
    const metadata = {
      slug: "snes-hero",
      title: "Super Nintendo Hero",
      originalFilename: "snes.png",
      contentType: "image/png",
      width: 640,
      height: 360,
      usages: [
        { kind: "PLATFORM_HERO", platformSlug: "snes", notes: "SNES hero" }
      ]
    };

    const response = await app.inject({
      method: "POST",
      url: "/admin/creative-assets",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
        "x-treaz-asset-metadata": JSON.stringify(metadata)
      },
      payload: Buffer.from("test asset")
    });

    expect(response.statusCode).toBe(201);
    const payload = await response.json();
    expect(payload.asset).toMatchObject({
      slug: "snes-hero",
      kind: "HERO",
      status: "ACTIVE",
      usages: [
        expect.objectContaining({
          kind: "PLATFORM_HERO",
          platform: expect.objectContaining({ slug: "snes" })
        })
      ]
    });

    expect(prismaMock.creativeAsset.create).toHaveBeenCalled();
    expect(prismaMock.creativeAssetUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assetId: creativeAssetId, platformId }),
      include: { platform: true }
    });
    const storage = app.storage as unknown as { putObject: ReturnType<typeof vi.fn> };
    expect(storage.putObject).toHaveBeenCalledWith(
      "assets",
      expect.stringContaining("creative-assets/snes-hero"),
      expect.objectContaining({ contentType: "image/png" })
    );
  });

  it("assigns curated hero art to platforms via usage routes", async () => {
    const now = new Date();
    prismaMock.creativeAsset.findUnique
      .mockResolvedValueOnce({ id: creativeAssetId, slug: "snes-hero" })
      .mockResolvedValueOnce({
        id: creativeAssetId,
        slug: "snes-hero",
        title: "Super Nintendo Hero",
        description: null,
        kind: "HERO",
        status: "ACTIVE",
        originalFilename: "snes.png",
        storageKey: "creative-assets/snes-hero/hero.png",
        mimeType: "image/png",
        width: 640,
        height: 360,
        fileSize: 1024,
        checksumSha256: "abc",
        checksumSha1: "def",
        checksumMd5: "ghi",
        createdAt: now,
        updatedAt: now,
        signedUrl: null,
        signedUrlExpiresAt: null,
        usages: [
          {
            id: creativeAssetUsageId,
            kind: "PLATFORM_HERO",
            targetKey: `platform:${platformId}`,
            notes: null,
            createdAt: now,
            updatedAt: now,
            platform: {
              id: platformId,
              slug: "snes",
              name: "Super Nintendo",
              shortName: "SNES"
            }
          }
        ]
      });
    prismaMock.platform.findUnique.mockResolvedValueOnce({ id: platformId, slug: "snes" });
    prismaMock.creativeAssetUsage.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.creativeAssetUsage.create.mockResolvedValueOnce({
      id: creativeAssetUsageId,
      kind: "PLATFORM_HERO",
      targetKey: `platform:${platformId}`,
      platformId,
      notes: null,
      createdAt: now,
      updatedAt: now,
      platform: {
        id: platformId,
        slug: "snes",
        name: "Super Nintendo",
        shortName: "SNES"
      }
    });
    prismaMock.creativeAssetAudit.create.mockResolvedValue({ id: "audit" });

    const token = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });
    const response = await app.inject({
      method: "POST",
      url: `/admin/creative-assets/${creativeAssetId}/usages`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        kind: "PLATFORM_HERO",
        platformSlug: "snes"
      }
    });

    expect(response.statusCode).toBe(201);
    const payload = await response.json();
    expect(payload.asset.usages).toHaveLength(1);
    expect(payload.asset.usages[0]).toMatchObject({
      kind: "PLATFORM_HERO",
      platform: expect.objectContaining({ slug: "snes" })
    });
    expect(prismaMock.creativeAssetUsage.deleteMany).toHaveBeenCalledWith({
      where: { kind: "PLATFORM_HERO", targetKey: `platform:${platformId}` }
    });
  });
});
