import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RomAssetType } from "@prisma/client";

const renderRequestSchema = z.object({
  romId: z.string().min(1),
  prompt: z.string().min(4),
  styleId: z.string().min(1).optional(),
  forceRefresh: z.boolean().optional(),
  assetType: z.nativeEnum(RomAssetType).optional()
});

const renderHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const cacheQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const regenerateParams = z.object({
  cacheKey: z.string().min(32)
});

const regenerateBody = z
  .object({
    styleId: z.string().min(1).optional()
  })
  .optional();

export async function registerAdminPixelLabRoutes(app: FastifyInstance): Promise<void> {
  if (!app.pixelLabService) {
    app.log.warn("PixelLab service is not configured; admin PixelLab routes disabled");
    return;
  }

  app.get("/pixellab/cache", async (request) => {
    const { limit } = cacheQuery.parse(request.query ?? {});
    const [summary, entries] = await Promise.all([
      app.pixelLabService!.getCacheSummary(),
      app.pixelLabService!.listCacheEntries(limit)
    ]);

    return {
      summary,
      entries: entries.map((entry) => ({
        id: entry.id,
        cacheKey: entry.cacheKey,
        prompt: entry.prompt,
        styleId: entry.styleId,
        romId: entry.romId,
        romAssetId: entry.romAssetId,
        expiresAt: entry.expiresAt?.toISOString() ?? null,
        hitCount: entry.hitCount,
        missCount: entry.missCount,
        lastRequestedAt: entry.lastRequestedAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        width: entry.width,
        height: entry.height,
        mimeType: entry.mimeType,
        fileSize: entry.fileSize,
        romTitle: entry.rom?.title ?? null,
        assetType: entry.romAsset?.type ?? null
      }))
    };
  });

  app.get("/pixellab/renders", async (request) => {
    const { limit } = renderHistoryQuery.parse(request.query ?? {});
    const renders = await app.pixelLabService!.listRecentRenders(limit);
    return {
      renders: renders.map((render) => ({
        ...render,
        createdAt: render.createdAt.toISOString()
      }))
    };
  });

  app.post("/pixellab/renders", async (request, reply) => {
    const payload = renderRequestSchema.safeParse(request.body ?? {});
    if (!payload.success) {
      return reply.status(400).send({
        message: "Invalid PixelLab render payload",
        errors: payload.error.flatten().fieldErrors
      });
    }

    const result = await app.pixelLabService!.renderHeroArt({
      romId: payload.data.romId,
      prompt: payload.data.prompt,
      styleId: payload.data.styleId,
      forceRefresh: payload.data.forceRefresh,
      assetType: payload.data.assetType
    });

    return {
      result
    };
  });

  app.post("/pixellab/renders/:cacheKey/regenerate", async (request, reply) => {
    const params = regenerateParams.safeParse(request.params ?? {});
    if (!params.success) {
      return reply.status(400).send({
        message: "Invalid cache key",
        errors: params.error.flatten().fieldErrors
      });
    }

    const body = regenerateBody.parse(request.body ?? {});
    const cacheEntry = await app.prisma.pixelLabCacheEntry.findUnique({
      where: { cacheKey: params.data.cacheKey }
    });

    if (!cacheEntry) {
      return reply.status(404).send({ message: "PixelLab cache entry not found" });
    }

    if (!cacheEntry.romId) {
      return reply.status(400).send({ message: "Cache entry is not associated with a ROM" });
    }

    const result = await app.pixelLabService!.renderHeroArt({
      romId: cacheEntry.romId,
      prompt: cacheEntry.prompt,
      styleId: body?.styleId ?? cacheEntry.styleId,
      forceRefresh: true
    });

    return { result };
  });
}
