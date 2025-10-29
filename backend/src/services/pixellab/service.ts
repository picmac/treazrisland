import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyBaseLogger } from "fastify";
import {
  PrismaClient,
  RomAssetSource,
  RomAssetType,
  type PixelLabCacheEntry,
  type PixelLabRenderLog
} from "@prisma/client";
import { StorageService } from "../storage/storage.js";
import type { PixelLabConfig } from "../../config/pixellab.js";

const DEFAULT_ASSET_TYPE = RomAssetType.COVER;

export type PixelLabRenderOptions = {
  romId: string;
  prompt: string;
  styleId?: string;
  forceRefresh?: boolean;
  assetType?: RomAssetType;
};

export type PixelLabRenderResult = {
  cacheKey: string;
  cacheHit: boolean;
  romAssetId: string;
  storageKey: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
};

export type PixelLabCacheSummary = {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  staleEntries: number;
  latestRenderAt: Date | null;
};

export type PixelLabRenderHistoryEntry = Pick<
  PixelLabRenderLog,
  "id" | "cacheKey" | "prompt" | "styleId" | "cacheHit" | "statusCode" | "durationMs" | "errorMessage" | "createdAt"
> & {
  rom?: { id: string; title: string } | null;
  romAsset?: { id: string; type: RomAssetType } | null;
};

export class PixelLabService {
  private readonly prisma: PrismaClient;
  private readonly storage: StorageService;
  private readonly logger: FastifyBaseLogger;
  private readonly config: PixelLabConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: {
    prisma: PrismaClient;
    storage: StorageService;
    logger: FastifyBaseLogger;
    config: PixelLabConfig;
    fetch?: typeof fetch;
  }) {
    this.prisma = deps.prisma;
    this.storage = deps.storage;
    this.logger = deps.logger;
    this.config = deps.config;
    this.fetchImpl = deps.fetch ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.styleId);
  }

  async renderHeroArt(options: PixelLabRenderOptions): Promise<PixelLabRenderResult> {
    if (!this.isConfigured()) {
      throw new Error("PixelLab service is not configured");
    }

    const styleId = options.styleId ?? this.config.styleId;
    const cacheKey = this.buildCacheKey(options.prompt, styleId);
    const assetType = options.assetType ?? DEFAULT_ASSET_TYPE;

    const existing = await this.prisma.pixelLabCacheEntry.findUnique({
      where: { cacheKey },
      include: { romAsset: true }
    });

    const now = new Date();
    const isExpired = existing?.expiresAt ? existing.expiresAt.getTime() <= now.getTime() : false;
    const shouldRefresh = options.forceRefresh || !existing || isExpired || !existing.romAsset;

    if (!shouldRefresh && existing && existing.romAsset) {
      await this.recordCacheHit(existing, options.romId);
      this.logger.info(
        { cacheKey, prompt: options.prompt, styleId, romId: options.romId },
        "PixelLab cache hit"
      );
      return {
        cacheKey,
        cacheHit: true,
        romAssetId: existing.romAssetId!,
        storageKey: existing.romAsset.storageKey,
        mimeType: existing.mimeType ?? null,
        width: existing.width ?? null,
        height: existing.height ?? null,
        fileSize: existing.fileSize ?? null
      };
    }

    const renderStart = Date.now();
    let statusCode: number | undefined;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(new URL("/renders", this.config.baseUrl), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey
          },
          body: JSON.stringify({
            prompt: options.prompt,
            styleId
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      statusCode = response.status;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `PixelLab render failed with status ${response.status}: ${errorText || response.statusText}`
        );
      }

      const payload = (await response.json()) as PixelLabApiResponse;
      if (!payload?.image?.base64) {
        throw new Error("PixelLab response missing image payload");
      }

      const buffer = Buffer.from(payload.image.base64, "base64");
      if (buffer.length === 0) {
        throw new Error("PixelLab returned empty render payload");
      }

      const mimeType = payload.image.mimeType ?? "image/png";
      const extension = mimeType.split("/")[1] ?? "png";
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const size = buffer.length;
      const width = coerceDimension(payload.image.width);
      const height = coerceDimension(payload.image.height);
      const tempDir = await mkdtemp(join(tmpdir(), "pixellab-"));
      const tempFile = join(tempDir, `render.${extension}`);
      await writeFile(tempFile, buffer);

      const storageKey = this.buildStorageKey(options.romId, cacheKey, extension);
      try {
        await this.storage.putObject(this.storage.assetBucket, storageKey, {
          filePath: tempFile,
          size,
          sha256,
          contentType: mimeType,
          metadata: {
            prompt: options.prompt,
            styleId,
            cacheKey
          }
        });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }

      const durationMs = Date.now() - renderStart;
      const expiresAt = new Date(now.getTime() + this.config.cacheTtlSeconds * 1000);

      const result = await this.prisma.$transaction(async (tx) => {
        const romAsset = await tx.romAsset.upsert({
          where: {
            romId_providerId: {
              romId: options.romId,
              providerId: cacheKey
            }
          },
          update: {
            type: assetType,
            source: RomAssetSource.PIXELLAB,
            storageKey,
            format: extension,
            fileSize: size,
            checksum: sha256,
            width,
            height
          },
          create: {
            romId: options.romId,
            type: assetType,
            source: RomAssetSource.PIXELLAB,
            providerId: cacheKey,
            storageKey,
            format: extension,
            fileSize: size,
            checksum: sha256,
            width,
            height
          }
        });

        const cacheEntry = await tx.pixelLabCacheEntry.upsert({
          where: { cacheKey },
          update: {
            prompt: options.prompt,
            styleId,
            romId: options.romId,
            romAssetId: romAsset.id,
            storageKey,
            mimeType,
            width,
            height,
            fileSize: size,
            expiresAt,
            missCount: { increment: 1 },
            lastRequestedAt: now
          },
          create: {
            cacheKey,
            prompt: options.prompt,
            styleId,
            romId: options.romId,
            romAssetId: romAsset.id,
            storageKey,
            mimeType,
            width,
            height,
            fileSize: size,
            expiresAt,
            missCount: 1,
            lastRequestedAt: now
          }
        });

        await tx.pixelLabRenderLog.create({
          data: {
            cacheEntryId: cacheEntry.id,
            romId: options.romId,
            romAssetId: romAsset.id,
            cacheKey,
            prompt: options.prompt,
            styleId,
            cacheHit: false,
            statusCode: statusCode ?? null,
            durationMs,
            errorMessage: null
          }
        });

        return { cacheEntry, romAsset };
      });

      this.logger.info(
        {
          cacheKey,
          prompt: options.prompt,
          styleId,
          romId: options.romId,
          durationMs,
          cacheHit: false
        },
        "PixelLab render generated"
      );

      return {
        cacheKey,
        cacheHit: false,
        romAssetId: result.romAsset.id,
        storageKey,
        mimeType,
        width,
        height,
        fileSize: size
      };
    } catch (err) {
      await this.recordRenderError({
        cacheKey,
        prompt: options.prompt,
        styleId,
        romId: options.romId,
        statusCode,
        error: err
      });
      throw err;
    }
  }

  async listRecentRenders(limit = 25): Promise<PixelLabRenderHistoryEntry[]> {
    const logs = await this.prisma.pixelLabRenderLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        rom: { select: { id: true, title: true } },
        romAsset: { select: { id: true, type: true } }
      }
    });

    return logs.map((log) => ({
      id: log.id,
      cacheKey: log.cacheKey,
      prompt: log.prompt,
      styleId: log.styleId,
      cacheHit: log.cacheHit,
      statusCode: log.statusCode ?? null,
      durationMs: log.durationMs ?? null,
      errorMessage: log.errorMessage ?? null,
      createdAt: log.createdAt,
      rom: log.rom ? { id: log.rom.id, title: log.rom.title } : null,
      romAsset: log.romAsset ? { id: log.romAsset.id, type: log.romAsset.type } : null
    }));
  }

  async getCacheSummary(): Promise<PixelLabCacheSummary> {
    const [aggregate, staleCount, latestLog] = await Promise.all([
      this.prisma.pixelLabCacheEntry.aggregate({
        _count: { _all: true },
        _sum: { hitCount: true, missCount: true }
      }),
      this.prisma.pixelLabCacheEntry.count({
        where: {
          expiresAt: { lt: new Date() }
        }
      }),
      this.prisma.pixelLabRenderLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

    const entries = aggregate._count._all;
    const hits = aggregate._sum.hitCount ?? 0;
    const misses = aggregate._sum.missCount ?? 0;
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return {
      entries,
      hits,
      misses,
      hitRate,
      staleEntries: staleCount,
      latestRenderAt: latestLog?.createdAt ?? null
    };
  }

  async listCacheEntries(
    limit = 50,
  ): Promise<
    Array<
      PixelLabCacheEntry & {
        rom: { id: string; title: string } | null;
        romAsset: { id: string; type: RomAssetType } | null;
      }
    >
  > {
    return this.prisma.pixelLabCacheEntry.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        rom: { select: { id: true, title: true } },
        romAsset: { select: { id: true, type: true } },
      },
    });
  }

  private buildCacheKey(prompt: string, styleId: string): string {
    return createHash("sha256").update(`${styleId}\u0000${prompt}`).digest("hex");
  }

  private buildStorageKey(romId: string, cacheKey: string, extension: string): string {
    return `${this.config.assetPrefix}/${romId}/${cacheKey}.${extension}`;
  }

  private async recordCacheHit(entry: PixelLabCacheEntry, romId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.pixelLabCacheEntry.update({
        where: { id: entry.id },
        data: {
          hitCount: { increment: 1 },
          lastRequestedAt: now,
          romId
        }
      }),
      this.prisma.pixelLabRenderLog.create({
        data: {
          cacheEntryId: entry.id,
          romId,
          romAssetId: entry.romAssetId,
          cacheKey: entry.cacheKey,
          prompt: entry.prompt,
          styleId: entry.styleId,
          cacheHit: true,
          statusCode: null,
          durationMs: 0,
          errorMessage: null
        }
      })
    ]);
  }

  private async recordRenderError(params: {
    cacheKey: string;
    prompt: string;
    styleId: string;
    romId: string;
    statusCode?: number;
    error: unknown;
  }): Promise<void> {
    const { cacheKey, prompt, styleId, romId, statusCode, error } = params;
    const message = error instanceof Error ? error.message : "Unknown PixelLab error";
    this.logger.error(
      { cacheKey, prompt, styleId, romId, statusCode, err: error },
      "PixelLab render failed"
    );

    await this.prisma.pixelLabRenderLog.create({
      data: {
        cacheEntryId: null,
        romId,
        romAssetId: null,
        cacheKey,
        prompt,
        styleId,
        cacheHit: false,
        statusCode: statusCode ?? null,
        durationMs: null,
        errorMessage: message
      }
    });
  }
}

function coerceDimension(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

type PixelLabApiResponse = {
  id: string;
  image: {
    base64: string;
    mimeType?: string;
    width?: number | null;
    height?: number | null;
  };
};
