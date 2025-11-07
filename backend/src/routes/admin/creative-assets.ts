import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { posix as pathPosix } from "node:path";
import {
  CreativeAssetAuditAction,
  CreativeAssetAuditStatus,
  CreativeAssetKind,
  CreativeAssetStatus,
  CreativeAssetUsageKind
} from "../../utils/prisma-enums.js";
import { safeUnlink } from "../../services/storage/storage.js";

const METADATA_HEADER = "x-treaz-asset-metadata";
const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MiB ceiling for curated artwork
const LIBRARY_USAGE_TARGET = "library";
const STORAGE_PREFIX = "creative-assets";

const binaryContentTypes = [
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif"
];

const usageInputSchema = z
  .object({
    kind: z.nativeEnum(CreativeAssetUsageKind),
    platformSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-_]*$/i, "platformSlug must be alphanumeric with dashes or underscores")
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, "notes must be 500 characters or fewer")
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.kind === CreativeAssetUsageKind.PLATFORM_HERO && !value.platformSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platformSlug"],
        message: "platformSlug is required for platform hero artwork"
      });
    }
    if (value.kind === CreativeAssetUsageKind.LIBRARY_HERO && value.platformSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platformSlug"],
        message: "platformSlug is not applicable for library hero artwork"
      });
    }
  });

type UsageInput = z.infer<typeof usageInputSchema>;

const assetUploadMetadataSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, "slug is required")
      .max(64, "slug must be at most 64 characters")
      .regex(/^[a-z0-9][a-z0-9-_]*$/i, "slug must be alphanumeric with dashes or underscores"),
    title: z
      .string()
      .trim()
      .min(1, "title is required")
      .max(160, "title must be at most 160 characters"),
    description: z
      .string()
      .trim()
      .max(500, "description must be at most 500 characters")
      .optional(),
    kind: z.nativeEnum(CreativeAssetKind).default(CreativeAssetKind.HERO),
    status: z.nativeEnum(CreativeAssetStatus).default(CreativeAssetStatus.ACTIVE),
    originalFilename: z
      .string()
      .trim()
      .min(1, "originalFilename is required")
      .max(255, "originalFilename must be at most 255 characters"),
    contentType: z
      .string()
      .trim()
      .max(120, "contentType must be at most 120 characters")
      .optional(),
    width: z
      .number({ invalid_type_error: "width must be a number" })
      .int("width must be an integer")
      .positive("width must be greater than zero")
      .optional(),
    height: z
      .number({ invalid_type_error: "height must be a number" })
      .int("height must be an integer")
      .positive("height must be greater than zero")
      .optional(),
    usages: z
      .array(usageInputSchema)
      .max(8, "no more than 8 usage records can be assigned at creation time")
      .optional()
      .default([])
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const usage of value.usages ?? []) {
      const key = `${usage.kind}|${usage.platformSlug ?? "*"}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate usage entries detected",
          path: ["usages"]
        });
        break;
      }
      seen.add(key);
    }
  });

type AssetUploadMetadata = z.infer<typeof assetUploadMetadataSchema>;

const assetUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "title cannot be empty")
      .max(160, "title must be at most 160 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "description must be at most 500 characters")
      .optional(),
    status: z.nativeEnum(CreativeAssetStatus).optional(),
    kind: z.nativeEnum(CreativeAssetKind).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No updates provided"
  });

type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;

const assetFileUpdateSchema = z.object({
  originalFilename: z
    .string()
    .trim()
    .min(1, "originalFilename is required")
    .max(255, "originalFilename must be at most 255 characters"),
  contentType: z
    .string()
    .trim()
    .max(120, "contentType must be at most 120 characters")
    .optional(),
  width: z
    .number({ invalid_type_error: "width must be a number" })
    .int("width must be an integer")
    .positive("width must be greater than zero")
    .optional(),
  height: z
    .number({ invalid_type_error: "height must be a number" })
    .int("height must be an integer")
    .positive("height must be greater than zero")
    .optional()
});

type AssetFileUpdateMetadata = z.infer<typeof assetFileUpdateSchema>;

const assetIdParamSchema = z.object({
  assetId: z.string().cuid("assetId must be a valid cuid")
});

const usageIdParamSchema = z.object({
  assetId: z.string().cuid("assetId must be a valid cuid"),
  usageId: z.string().cuid("usageId must be a valid cuid")
});

type PrismaTransaction = Prisma.TransactionClient;

type CreativeAssetWithRelations = Prisma.CreativeAssetGetPayload<{
  include: typeof creativeAssetInclude;
}>;

type CreativeAssetUsageWithRelations = Prisma.CreativeAssetUsageGetPayload<{
  include: { platform: true };
}>;

const creativeAssetInclude = {
  usages: {
    orderBy: { createdAt: "desc" as const },
    include: {
      platform: true
    }
  }
} satisfies Prisma.CreativeAssetInclude;

type PersistedAsset = {
  filePath: string;
  size: number;
  sha256: string;
  sha1: string;
  md5: string;
};

export async function registerCreativeAssetRoutes(app: FastifyInstance): Promise<void> {
  const streamParser = (
    _request: unknown,
    payload: NodeJS.ReadableStream,
    done: (err: Error | null, body?: unknown) => void
  ) => {
    done(null, payload);
  };

  for (const contentType of binaryContentTypes) {
    if (!app.hasContentTypeParser(contentType)) {
      app.addContentTypeParser(contentType, streamParser);
    }
  }

  app.get("/creative-assets", async (request) => {
    const assets = await app.prisma.creativeAsset.findMany({
      orderBy: { createdAt: "desc" },
      include: creativeAssetInclude
    });

    const hydrated = await Promise.all(
      assets.map((asset) => toCreativeAssetResponse(app, asset))
    );

    request.log.debug(
      { event: "creativeAsset.list", count: hydrated.length },
      "Listed creative assets"
    );

    return { assets: hydrated };
  });

  app.post("/creative-assets", async (request, reply) => {
    const metadata = parseMetadataHeader(app, request.headers[METADATA_HEADER]);

    if (
      !request.body ||
      typeof (request.body as NodeJS.ReadableStream).pipe !== "function"
    ) {
      throw app.httpErrors.badRequest("Binary payload is required");
    }

    const stream = request.body as NodeJS.ReadableStream;
    const filename = sanitizeFilename(metadata.originalFilename);
    const storageKey = buildStorageKey(metadata.slug, filename);
    const actorId = request.user?.sub ?? null;
    const contentTypeHeader = request.headers["content-type"];
    const contentType =
      metadata.contentType ??
      (typeof contentTypeHeader === "string"
        ? contentTypeHeader.split(";")[0].trim().toLowerCase()
        : undefined);

    const processed = await persistAssetStream(stream, filename);

    let stored = false;
    try {
      await app.storage.putObject(app.storage.assetBucket, storageKey, {
        filePath: processed.filePath,
        size: processed.size,
        sha256: processed.sha256,
        sha1: processed.sha1,
        md5: processed.md5,
        contentType
      });
      stored = true;
    } catch (error) {
      request.log.error(
        {
          event: "creativeAsset.upload",
          slug: metadata.slug,
          storageKey,
          error: error instanceof Error ? error.message : error
        },
        "Failed to persist creative asset payload"
      );
      throw app.httpErrors.internalServerError("Unable to store creative asset");
    } finally {
      await safeUnlink(processed.filePath).catch(() => {});
    }

    try {
      const asset = await app.prisma.$transaction(async (tx) => {
        const created = await tx.creativeAsset.create({
          data: {
            slug: metadata.slug,
            title: metadata.title,
            description: metadata.description ?? null,
            kind: metadata.kind,
            status: metadata.status,
            originalFilename: metadata.originalFilename,
            storageKey,
            mimeType: contentType,
            width: metadata.width ?? null,
            height: metadata.height ?? null,
            fileSize: processed.size,
            checksumSha256: processed.sha256,
            checksumSha1: processed.sha1,
            checksumMd5: processed.md5,
            createdById: actorId,
            updatedById: actorId
          }
        });

        for (const usage of metadata.usages ?? []) {
          await createUsageRecord(app, tx, {
            assetId: created.id,
            usageInput: usage,
            actorId
          });
        }

        await tx.creativeAssetAudit.create({
          data: {
            assetId: created.id,
            action: CreativeAssetAuditAction.CREATE_ASSET,
            status: CreativeAssetAuditStatus.SUCCEEDED,
            performedById: actorId,
            details: {
              slug: created.slug,
              storageKey,
              fileSize: processed.size,
              checksumSha256: processed.sha256
            }
          }
        });

        const withRelations = await tx.creativeAsset.findUnique({
          where: { id: created.id },
          include: creativeAssetInclude
        });

        return withRelations!;
      });

      request.log.info(
        {
          event: "creativeAsset.create",
          assetId: asset.id,
          slug: asset.slug,
          storageKey
        },
        "Creative asset created"
      );

      reply.code(201);
      return { asset: await toCreativeAssetResponse(app, asset) };
    } catch (error) {
      if (stored) {
        await app.storage
          .deleteAssetObject(storageKey)
          .catch(() => {});
      }
      request.log.error(
        {
          event: "creativeAsset.create.failed",
          slug: metadata.slug,
          storageKey,
          error: error instanceof Error ? error.message : error
        },
        "Failed to finalize creative asset creation"
      );
      throw error;
    }
  });

  app.patch("/creative-assets/:assetId", async (request) => {
    const params = assetIdParamSchema.parse(request.params);
    const body = assetUpdateSchema.parse(request.body ?? {});
    const actorId = request.user?.sub ?? null;

    const updated = await app.prisma.$transaction(async (tx) => {
      const existing = await tx.creativeAsset.findUnique({
        where: { id: params.assetId }
      });

      if (!existing) {
        throw app.httpErrors.notFound("Creative asset not found");
      }

      const next = await tx.creativeAsset.update({
        where: { id: params.assetId },
        data: {
          ...body,
          updatedById: actorId
        },
        include: creativeAssetInclude
      });

      await tx.creativeAssetAudit.create({
        data: {
          assetId: next.id,
          action: CreativeAssetAuditAction.UPDATE_ASSET,
          status: CreativeAssetAuditStatus.SUCCEEDED,
          performedById: actorId,
          details: {
            changedFields: Object.keys(body)
          }
        }
      });

      return next;
    });

    request.log.info(
      {
        event: "creativeAsset.update",
        assetId: updated.id,
        changed: Object.keys(body)
      },
      "Creative asset metadata updated"
    );

    return { asset: await toCreativeAssetResponse(app, updated) };
  });

  app.post("/creative-assets/:assetId/file", async (request) => {
    const params = assetIdParamSchema.parse(request.params);
    const metadata = parseFileMetadataHeader(app, request.headers[METADATA_HEADER]);

    if (
      !request.body ||
      typeof (request.body as NodeJS.ReadableStream).pipe !== "function"
    ) {
      throw app.httpErrors.badRequest("Binary payload is required");
    }

    const existing = await app.prisma.creativeAsset.findUnique({
      where: { id: params.assetId }
    });

    if (!existing) {
      throw app.httpErrors.notFound("Creative asset not found");
    }

    const filename = sanitizeFilename(metadata.originalFilename);
    const storageKey = buildStorageKey(existing.slug, filename);
    const actorId = request.user?.sub ?? null;
    const contentTypeHeader = request.headers["content-type"];
    const contentType =
      metadata.contentType ??
      (typeof contentTypeHeader === "string"
        ? contentTypeHeader.split(";")[0].trim().toLowerCase()
        : undefined);

    const processed = await persistAssetStream(
      request.body as NodeJS.ReadableStream,
      filename
    );

    let stored = false;
    try {
      await app.storage.putObject(app.storage.assetBucket, storageKey, {
        filePath: processed.filePath,
        size: processed.size,
        sha256: processed.sha256,
        sha1: processed.sha1,
        md5: processed.md5,
        contentType
      });
      stored = true;
    } catch (error) {
      request.log.error(
        {
          event: "creativeAsset.replace.failed",
          assetId: existing.id,
          storageKey,
          error: error instanceof Error ? error.message : error
        },
        "Failed to persist replacement creative asset payload"
      );
      throw app.httpErrors.internalServerError("Unable to store creative asset");
    } finally {
      await safeUnlink(processed.filePath).catch(() => {});
    }

    try {
      const updated = await app.prisma.$transaction(async (tx) => {
        const next = await tx.creativeAsset.update({
          where: { id: params.assetId },
          data: {
            originalFilename: metadata.originalFilename,
            storageKey,
            mimeType: contentType,
            width: metadata.width ?? null,
            height: metadata.height ?? null,
            fileSize: processed.size,
            checksumSha256: processed.sha256,
            checksumSha1: processed.sha1,
            checksumMd5: processed.md5,
            updatedById: actorId
          },
          include: creativeAssetInclude
        });

        await tx.creativeAssetAudit.create({
          data: {
            assetId: next.id,
            action: CreativeAssetAuditAction.UPDATE_ASSET,
            status: CreativeAssetAuditStatus.SUCCEEDED,
            performedById: actorId,
            details: {
              previousStorageKey: existing.storageKey,
              storageKey,
              fileSize: processed.size,
              checksumSha256: processed.sha256
            }
          }
        });

        return next;
      });

      if (existing.storageKey !== storageKey) {
        await app.storage
          .deleteAssetObject(existing.storageKey)
          .catch((error: unknown) => {
            request.log.warn(
              {
                event: "creativeAsset.cleanup.failed",
                assetId: existing.id,
                storageKey: existing.storageKey,
                error: error instanceof Error ? error.message : error
              },
              "Failed to delete previous creative asset object"
            );
          });
      }

      request.log.info(
        {
          event: "creativeAsset.replace",
          assetId: existing.id,
          storageKey
        },
        "Creative asset binary replaced"
      );

      return { asset: await toCreativeAssetResponse(app, updated) };
    } catch (error) {
      if (stored) {
        await app.storage
          .deleteAssetObject(storageKey)
          .catch(() => {});
      }
      request.log.error(
        {
          event: "creativeAsset.replace.transactionFailed",
          assetId: existing.id,
          storageKey,
          error: error instanceof Error ? error.message : error
        },
        "Failed to finalize creative asset replacement"
      );
      throw error;
    }
  });

  app.post("/creative-assets/:assetId/usages", async (request, reply) => {
    const params = assetIdParamSchema.parse(request.params);
    const body = usageInputSchema.parse(request.body ?? {});
    const actorId = request.user?.sub ?? null;

    const asset = await app.prisma.creativeAsset.findUnique({
      where: { id: params.assetId }
    });

    if (!asset) {
      throw app.httpErrors.notFound("Creative asset not found");
    }

    const usage = await app.prisma.$transaction(async (tx) => {
      await createUsageRecord(app, tx, {
        assetId: params.assetId,
        usageInput: body,
        actorId
      });

      const refreshed = await tx.creativeAsset.findUnique({
        where: { id: params.assetId },
        include: creativeAssetInclude
      });

      return refreshed!;
    });

    request.log.info(
      {
        event: "creativeAsset.usage.assign",
        assetId: params.assetId,
        kind: body.kind,
        platformSlug: body.platformSlug ?? null
      },
      "Creative asset usage assigned"
    );

    reply.code(201);
    return { asset: await toCreativeAssetResponse(app, usage) };
  });

  app.delete("/creative-assets/:assetId/usages/:usageId", async (request) => {
    const params = usageIdParamSchema.parse(request.params);
    const actorId = request.user?.sub ?? null;

    const usage = await app.prisma.creativeAssetUsage.findUnique({
      where: { id: params.usageId },
      include: { asset: true }
    });

    if (!usage || usage.assetId !== params.assetId) {
      throw app.httpErrors.notFound("Creative asset usage not found");
    }

    const asset = await app.prisma.$transaction(async (tx) => {
      await tx.creativeAssetAudit.create({
        data: {
          assetId: usage.assetId,
          usageId: usage.id,
          action: CreativeAssetAuditAction.REMOVE_USAGE,
          status: CreativeAssetAuditStatus.SUCCEEDED,
          performedById: actorId,
          details: {
            kind: usage.kind,
            targetKey: usage.targetKey
          }
        }
      });

      await tx.creativeAssetUsage.delete({ where: { id: usage.id } });

      const refreshed = await tx.creativeAsset.findUnique({
        where: { id: usage.assetId },
        include: creativeAssetInclude
      });

      return refreshed!;
    });

    request.log.info(
      {
        event: "creativeAsset.usage.remove",
        assetId: params.assetId,
        usageId: params.usageId
      },
      "Creative asset usage removed"
    );

    return { asset: await toCreativeAssetResponse(app, asset) };
  });

  app.delete("/creative-assets/:assetId", async (request, reply) => {
    const params = assetIdParamSchema.parse(request.params);
    const actorId = request.user?.sub ?? null;

    const existing = await app.prisma.creativeAsset.findUnique({
      where: { id: params.assetId }
    });

    if (!existing) {
      throw app.httpErrors.notFound("Creative asset not found");
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.creativeAssetAudit.create({
        data: {
          assetId: existing.id,
          action: CreativeAssetAuditAction.DELETE_ASSET,
          status: CreativeAssetAuditStatus.SUCCEEDED,
          performedById: actorId,
          details: {
            storageKey: existing.storageKey
          }
        }
      });

      await tx.creativeAsset.delete({ where: { id: existing.id } });
    });

    await app.storage
      .deleteAssetObject(existing.storageKey)
      .catch((error: unknown) => {
        request.log.warn(
          {
            event: "creativeAsset.delete.cleanupFailed",
            assetId: existing.id,
            storageKey: existing.storageKey,
            error: error instanceof Error ? error.message : error
          },
          "Failed to delete creative asset object from storage"
        );
      });

    request.log.info(
      {
        event: "creativeAsset.delete",
        assetId: existing.id,
        storageKey: existing.storageKey
      },
      "Creative asset deleted"
    );

    reply.code(204);
  });
}

async function createUsageRecord(
  app: FastifyInstance,
  tx: PrismaTransaction,
  params: { assetId: string; usageInput: UsageInput; actorId: string | null }
): Promise<CreativeAssetUsageWithRelations> {
  const { usageInput } = params;
  const { targetKey, platformId } = await resolveUsageTarget(app, tx, usageInput);

  await tx.creativeAssetUsage.deleteMany({
    where: {
      kind: usageInput.kind,
      targetKey
    }
  });

  const created = await tx.creativeAssetUsage.create({
    data: {
      assetId: params.assetId,
      kind: usageInput.kind,
      targetKey,
      platformId,
      notes: usageInput.notes ?? null,
      createdById: params.actorId
    },
    include: { platform: true }
  });

  await tx.creativeAssetAudit.create({
    data: {
      assetId: params.assetId,
      usageId: created.id,
      action: CreativeAssetAuditAction.ASSIGN_USAGE,
      status: CreativeAssetAuditStatus.SUCCEEDED,
      performedById: params.actorId,
      details: {
        kind: created.kind,
        targetKey,
        platformId
      }
    }
  });

  return created;
}

async function resolveUsageTarget(
  app: FastifyInstance,
  tx: PrismaTransaction,
  usage: UsageInput
): Promise<{ targetKey: string; platformId: string | null }> {
  if (usage.kind === CreativeAssetUsageKind.LIBRARY_HERO) {
    return { targetKey: LIBRARY_USAGE_TARGET, platformId: null };
  }

  const platform = await tx.platform.findUnique({
    where: { slug: usage.platformSlug! },
    select: { id: true }
  });

  if (!platform) {
    throw app.httpErrors.badRequest(
      `Unknown platform slug: ${usage.platformSlug}`
    );
  }

  return {
    targetKey: buildPlatformTargetKey(platform.id),
    platformId: platform.id
  };
}

function parseMetadataHeader(app: FastifyInstance, header: unknown): AssetUploadMetadata {
  if (typeof header !== "string" || header.trim().length === 0) {
    throw app.httpErrors.badRequest(`${METADATA_HEADER} header is required`);
  }

  try {
    return assetUploadMetadataSchema.parse(JSON.parse(header));
  } catch (error) {
    throw app.httpErrors.badRequest(
      error instanceof Error ? error.message : "Invalid creative asset metadata"
    );
  }
}

function parseFileMetadataHeader(
  app: FastifyInstance,
  header: unknown
): AssetFileUpdateMetadata {
  if (typeof header !== "string" || header.trim().length === 0) {
    throw app.httpErrors.badRequest(`${METADATA_HEADER} header is required`);
  }

  try {
    return assetFileUpdateSchema.parse(JSON.parse(header));
  } catch (error) {
    throw app.httpErrors.badRequest(
      error instanceof Error ? error.message : "Invalid creative asset metadata"
    );
  }
}

function sanitizeFilename(filename: string): string {
  const base = pathPosix.basename(filename);
  const sanitized = base.replace(/[\u0000-\u001f<>:"|?*\\/]+/g, "_");
  return sanitized.length > 0 ? sanitized : "asset.bin";
}

function buildStorageKey(slug: string, filename: string): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return pathPosix.join(STORAGE_PREFIX, slug, `${timestamp}-${filename}`);
}

function buildPlatformTargetKey(platformId: string): string {
  return `platform:${platformId}`;
}

async function persistAssetStream(
  stream: NodeJS.ReadableStream,
  filename: string
): Promise<PersistedAsset> {
  const tempDir = await mkdtemp(pathPosix.join(tmpdir(), "treaz-asset-"));
  const tempPath = pathPosix.join(tempDir, filename);
  const writeStream = createWriteStream(tempPath);

  const sha256 = createHash("sha256");
  const sha1 = createHash("sha1");
  const md5 = createHash("md5");

  let size = 0;

  try {
    for await (const chunk of stream) {
      const buffer =
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Buffer);
      size += buffer.length;
      if (size > MAX_ASSET_BYTES) {
        throw new Error("Creative asset exceeds maximum allowed size");
      }
      sha256.update(buffer);
      sha1.update(buffer);
      md5.update(buffer);
      if (!writeStream.write(buffer)) {
        await once(writeStream, "drain");
      }
    }
  } catch (error) {
    writeStream.destroy();
    await safeUnlink(tempPath).catch(() => {});
    throw error;
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err: NodeJS.ErrnoException | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  return {
    filePath: tempPath,
    size,
    sha256: sha256.digest("hex"),
    sha1: sha1.digest("hex"),
    md5: md5.digest("hex")
  };
}

async function toCreativeAssetResponse(
  app: FastifyInstance,
  asset: CreativeAssetWithRelations
) {
  const signed = await app.storage.getAssetObjectSignedUrl(asset.storageKey);

  return {
    id: asset.id,
    slug: asset.slug,
    title: asset.title,
    description: asset.description,
    kind: asset.kind,
    status: asset.status,
    originalFilename: asset.originalFilename,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    checksumSha256: asset.checksumSha256,
    checksumSha1: asset.checksumSha1,
    checksumMd5: asset.checksumMd5,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    signedUrl: signed?.url ?? null,
    signedUrlExpiresAt: signed?.expiresAt.toISOString() ?? null,
    usages: asset.usages.map((usage) => ({
      id: usage.id,
      kind: usage.kind,
      targetKey: usage.targetKey,
      platform: usage.platform
        ? {
            id: usage.platform.id,
            slug: usage.platform.slug,
            name: usage.platform.name,
            shortName: usage.platform.shortName
          }
        : null,
      notes: usage.notes,
      createdAt: usage.createdAt.toISOString(),
      updatedAt: usage.updatedAt.toISOString()
    }))
  };
}
