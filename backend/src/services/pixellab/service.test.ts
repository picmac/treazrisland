import { beforeEach, describe, expect, it, vi } from "vitest";
import { RomAssetSource, RomAssetType } from "@prisma/client";
import type { PixelLabConfig } from "../../config/pixellab.js";
import { PixelLabService } from "./service.js";

const pixelLabConfig: PixelLabConfig = {
  apiKey: "test-api-key",
  styleId: "style-default",
  baseUrl: "https://pixellab.example",
  cacheTtlSeconds: 3600,
  timeoutMs: 5000,
  assetPrefix: "pixellab"
};

type PrismaMock = {
  pixelLabCacheEntry: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pixelLabRenderLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  romAsset: {
    upsert: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("PixelLabService", () => {
  let prisma: PrismaMock;
  let storage: { assetBucket: string; putObject: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: PixelLabService;

  beforeEach(() => {
    prisma = {
      pixelLabCacheEntry: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
      },
      pixelLabRenderLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      romAsset: {
        upsert: vi.fn()
      },
      $transaction: vi.fn(async (callbackOrOps: any) => {
        if (typeof callbackOrOps === "function") {
          return callbackOrOps({
            romAsset: prisma.romAsset,
            pixelLabCacheEntry: prisma.pixelLabCacheEntry,
            pixelLabRenderLog: prisma.pixelLabRenderLog
          });
        }
        if (Array.isArray(callbackOrOps)) {
          const results = [];
          for (const op of callbackOrOps) {
            results.push(await op);
          }
          return results;
        }
        return null;
      })
    };

    storage = {
      assetBucket: "assets",
      putObject: vi.fn().mockResolvedValue(undefined)
    };

    fetchMock = vi.fn();

    service = new PixelLabService({
      prisma: prisma as unknown as any,
      storage: storage as unknown as any,
      logger: { info: vi.fn(), error: vi.fn(), child: () => ({ info: vi.fn(), error: vi.fn() }) } as any,
      config: pixelLabConfig,
      fetch: fetchMock
    });
  });

  it("returns cached render without calling PixelLab", async () => {
    const now = new Date();
    prisma.pixelLabCacheEntry.findUnique.mockResolvedValue({
      id: "cache_1",
      cacheKey: "abc",
      prompt: "Create a hero scene",
      styleId: "style-default",
      romId: "rom_1",
      romAssetId: "asset_1",
      storageKey: "pixellab/rom_1/abc.png",
      mimeType: "image/png",
      width: 800,
      height: 450,
      fileSize: 1024,
      expiresAt: new Date(now.getTime() + 1000),
      hitCount: 0,
      missCount: 0,
      lastRequestedAt: now,
      createdAt: now,
      updatedAt: now,
      romAsset: {
        id: "asset_1",
        romId: "rom_1",
        type: RomAssetType.COVER,
        source: RomAssetSource.PIXELLAB,
        providerId: "abc",
        storageKey: "pixellab/rom_1/abc.png",
        fileSize: 1024,
        checksum: "hash",
        format: "png",
        language: null,
        region: null,
        width: 800,
        height: 450,
        createdAt: now,
        updatedAt: now
      }
    });

    prisma.pixelLabCacheEntry.update.mockResolvedValue({});
    prisma.pixelLabRenderLog.create.mockResolvedValue({});

    const result = await service.renderHeroArt({
      romId: "rom_1",
      prompt: "Create a hero scene"
    });

    expect(result.cacheHit).toBe(true);
    expect(result.romAssetId).toBe("asset_1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.pixelLabCacheEntry.update).toHaveBeenCalled();
    expect(prisma.pixelLabRenderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cacheHit: true })
      })
    );
  });

  it("requests PixelLab render on cache miss and stores asset", async () => {
    prisma.pixelLabCacheEntry.findUnique.mockResolvedValue(null);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "render_1",
        image: {
          base64: Buffer.from("binary").toString("base64"),
          mimeType: "image/png",
          width: 320,
          height: 180
        }
      }),
      text: async () => "",
      statusText: "OK"
    });

    prisma.romAsset.upsert.mockResolvedValue({
      id: "asset_new",
      romId: "rom_1"
    });

    prisma.pixelLabCacheEntry.upsert.mockResolvedValue({
      id: "cache_new",
      cacheKey: "123",
      prompt: "Create hero art",
      styleId: "style-default",
      romId: "rom_1",
      romAssetId: "asset_new",
      storageKey: "pixellab/rom_1/123.png",
      mimeType: "image/png",
      width: 320,
      height: 180,
      fileSize: 6,
      expiresAt: new Date(),
      hitCount: 0,
      missCount: 1,
      lastRequestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prisma.pixelLabRenderLog.create.mockResolvedValue({});

    const result = await service.renderHeroArt({
      romId: "rom_1",
      prompt: "Create hero art"
    });

    expect(result.cacheHit).toBe(false);
    expect(storage.putObject).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/renders", pixelLabConfig.baseUrl),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": pixelLabConfig.apiKey })
      })
    );
    expect(prisma.romAsset.upsert).toHaveBeenCalled();
    expect(prisma.pixelLabCacheEntry.upsert).toHaveBeenCalled();
  });
});
