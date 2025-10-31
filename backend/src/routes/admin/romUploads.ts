import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { posix as pathPosix } from "node:path";
import { env } from "../../config/env.js";
import { safeUnlink } from "../../services/storage/storage.js";
import { Crc32 } from "../../utils/crc32.js";

const uploadMetadataSchema = z
  .object({
    clientId: z.string().min(1),
    type: z.enum(["rom", "bios"]),
    originalFilename: z.string().min(1),
    platformSlug: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-_]*$/i,
        "platformSlug must be alphanumeric with dashes or underscores",
      )
      .optional(),
    romTitle: z.string().optional(),
    biosCore: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-_]*$/i,
        "biosCore must be alphanumeric with dashes or underscores",
      )
      .optional(),
    biosRegion: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "rom" && !value.platformSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "platformSlug is required for ROM uploads",
        path: ["platformSlug"],
      });
    }
    if (value.type === "bios" && !value.biosCore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "biosCore is required for BIOS uploads",
        path: ["biosCore"],
      });
    }
  });

type UploadMetadata = z.infer<typeof uploadMetadataSchema>;

type ProcessedUpload = {
  filePath: string;
  size: number;
  sha256: string;
  sha1: string;
  md5: string;
  crc32: string;
};

type UploadResult =
  | {
      status: "success";
      metadata: UploadMetadata;
      romId?: string;
      romTitle?: string;
      platformSlug?: string;
      biosId?: string;
      biosCore?: string;
      storageKey: string;
      archiveSize: number;
      checksumSha256: string;
      uploadAuditId: string;
    }
  | {
      status: "duplicate";
      metadata: UploadMetadata;
      romId?: string;
      romTitle?: string;
      biosId?: string;
      biosCore?: string;
      reason: string;
      uploadAuditId: string;
    };

export async function registerRomUploadRoutes(
  app: FastifyInstance,
): Promise<void> {
  const streamParser = (
    request: unknown,
    payload: NodeJS.ReadableStream,
    done: (err: Error | null, body?: unknown) => void,
  ) => {
    done(null, payload);
  };

  app.addContentTypeParser("application/octet-stream", streamParser);
  app.addContentTypeParser("application/zip", streamParser);
  app.addContentTypeParser("application/x-zip-compressed", streamParser);

  app.post("/roms/uploads", async (request, reply) => {
    const metadataHeader = request.headers["x-treaz-upload-metadata"];
    if (
      typeof metadataHeader !== "string" ||
      metadataHeader.trim().length === 0
    ) {
      throw app.httpErrors.badRequest(
        "x-treaz-upload-metadata header is required",
      );
    }

    let metadata: UploadMetadata;
    try {
      metadata = uploadMetadataSchema.parse(JSON.parse(metadataHeader));
    } catch (error) {
      throw app.httpErrors.badRequest(
        error instanceof Error ? error.message : "Invalid upload metadata",
      );
    }

    if (
      !request.body ||
      typeof (request.body as NodeJS.ReadableStream).pipe !== "function"
    ) {
      throw app.httpErrors.badRequest("Binary payload is required");
    }

    const contentLengthHeader = request.headers["content-length"];
    if (typeof contentLengthHeader === "string") {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isFinite(contentLength)) {
        throw app.httpErrors.badRequest("Invalid Content-Length header");
      }
      if (contentLength > env.ROM_UPLOAD_MAX_BYTES) {
        throw app.httpErrors.payloadTooLarge(
          "Archive exceeds maximum allowed size",
        );
      }
    }

    const safeFilename = sanitizeFilename(metadata.originalFilename);
    const contentTypeHeader = request.headers["content-type"];
    const archiveMimeType =
      typeof contentTypeHeader === "string"
        ? contentTypeHeader.split(";")[0].trim().toLowerCase()
        : "application/octet-stream";

    const storageKey = buildStorageKey(metadata, safeFilename);

    let processed: ProcessedUpload | undefined;
    const stream = request.body as NodeJS.ReadableStream;

    const uploadedById = request.user?.sub;
    const uploadStartedAt = process.hrtime.bigint();

    try {
      processed = await persistUploadStream(stream, safeFilename);

      if (metadata.type === "rom") {
        const result = await handleRomUpload(
          app,
          metadata,
          processed,
          storageKey,
          archiveMimeType,
          uploadedById,
          safeFilename,
        );
        await safeUnlink(processed.filePath);

        recordUploadOutcome(app, uploadStartedAt, {
          kind: "rom",
          status: result.status,
          reason: result.status === "success" ? "none" : result.reason,
        });

        if (result.status === "success") {
          request.log.info(
            {
              event: "rom.upload",
              status: result.status,
              romId: result.romId,
              platformSlug: result.platformSlug,
              archiveSize: result.archiveSize,
              checksumSha256: result.checksumSha256,
              uploadAuditId: result.uploadAuditId,
            },
            "ROM upload succeeded",
          );
        } else {
          request.log.info(
            {
              event: "rom.upload",
              status: result.status,
              romId: result.romId,
              reason: result.reason,
              uploadAuditId: result.uploadAuditId,
            },
            "Duplicate ROM upload detected",
          );
        }

        return reply
          .code(result.status === "success" ? 201 : 200)
          .send({ result });
      }

      const result = await handleBiosUpload(
        app,
        metadata,
        processed,
        storageKey,
        archiveMimeType,
        uploadedById,
        safeFilename,
      );
      await safeUnlink(processed.filePath);

      recordUploadOutcome(app, uploadStartedAt, {
        kind: "bios",
        status: result.status,
        reason: result.status === "success" ? "none" : result.reason,
      });

      if (result.status === "success") {
        request.log.info(
          {
            event: "bios.upload",
            status: result.status,
            biosCore: result.biosCore,
            archiveSize: result.archiveSize,
            checksumSha256: result.checksumSha256,
            uploadAuditId: result.uploadAuditId,
          },
          "BIOS upload succeeded",
        );
      } else {
        request.log.info(
          {
            event: "bios.upload",
            status: result.status,
            biosCore: result.biosCore,
            reason: result.reason,
            uploadAuditId: result.uploadAuditId,
          },
          "Duplicate BIOS upload detected",
        );
      }

      return reply
        .code(result.status === "success" ? 201 : 200)
        .send({ result });
    } catch (error) {
      if (processed) {
        await safeUnlink(processed.filePath).catch(() => {});
      }

      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      const failureReason = deriveUploadFailureReason(error);

      recordUploadOutcome(app, uploadStartedAt, {
        kind: metadata.type,
        status: "failed",
        reason: failureReason,
      });

      if (typeof (error as { statusCode?: number }).statusCode === "number") {
        throw error;
      }
      await recordFailedAudit(
        app,
        metadata,
        storageKey,
        archiveMimeType,
        processed,
        errorMessage,
        uploadedById,
        safeFilename,
      );

      if (error instanceof z.ZodError) {
        throw app.httpErrors.badRequest(errorMessage);
      }

      if (errorMessage.includes("maximum allowed size")) {
        throw app.httpErrors.payloadTooLarge(errorMessage);
      }

      request.log.error(
        { err: error, event: `${metadata.type}.upload` },
        "Upload failed",
      );
      throw app.httpErrors.internalServerError(errorMessage);
    }
  });
}

async function handleRomUpload(
  app: FastifyInstance,
  metadata: UploadMetadata,
  processed: ProcessedUpload,
  storageKey: string,
  archiveMimeType: string,
  uploadedById: string | undefined,
  safeFilename: string,
): Promise<UploadResult> {
  const platform = await app.prisma.platform.findUnique({
    where: { slug: metadata.platformSlug! },
  });

  if (!platform) {
    throw app.httpErrors.badRequest(
      `Unknown platform slug: ${metadata.platformSlug}`,
    );
  }

  const duplicateBinary = await app.prisma.romBinary.findFirst({
    where: {
      checksumSha256: processed.sha256,
      rom: { platformId: platform.id },
    },
    include: {
      rom: true,
    },
  });

  if (duplicateBinary) {
    const audit = await app.prisma.romUploadAudit.create({
      data: {
        kind: "ROM",
        status: "FAILED",
        romId: duplicateBinary.romId,
        romBinaryId: duplicateBinary.id,
        platformId: platform.id,
        uploadedById: uploadedById ?? null,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
        errorMessage: `Duplicate ROM detected for ${duplicateBinary.rom.title}`,
      },
    });

    return {
      status: "duplicate",
      metadata,
      romId: duplicateBinary.romId,
      romTitle: duplicateBinary.rom.title,
      reason: "Duplicate ROM binary",
      uploadAuditId: audit.id,
    };
  }

  await app.storage.putRomObject(storageKey, {
    filePath: processed.filePath,
    size: processed.size,
    sha256: processed.sha256,
    sha1: processed.sha1,
    md5: processed.md5,
    crc32: processed.crc32,
    contentType: archiveMimeType,
  });

  const romTitle = deriveRomTitle(metadata);
  const now = new Date();

  const { rom, binary, audit } = await app.prisma.$transaction(async (tx) => {
    const existing = await tx.rom.findFirst({
      where: { platformId: platform.id, title: romTitle },
    });

    const romRecord = existing
      ? await tx.rom.update({
          where: { id: existing.id },
          data: {
            romHash: processed.sha256,
            romSize: processed.size,
            updatedAt: now,
          },
        })
      : await tx.rom.create({
          data: {
            platformId: platform.id,
            title: romTitle,
            romHash: processed.sha256,
            romSize: processed.size,
          },
        });

    const binaryRecord = await tx.romBinary.upsert({
      where: { romId: romRecord.id },
      create: {
        romId: romRecord.id,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
        status: "READY",
      },
      update: {
        storageKey,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
        status: "READY",
        updatedAt: now,
      },
    });

    const auditRecord = await tx.romUploadAudit.create({
      data: {
        kind: "ROM",
        status: "SUCCEEDED",
        romId: romRecord.id,
        romBinaryId: binaryRecord.id,
        platformId: platform.id,
        uploadedById: uploadedById ?? null,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
      },
    });

    return { rom: romRecord, binary: binaryRecord, audit: auditRecord };
  });

  return {
    status: "success",
    metadata,
    romId: rom.id,
    romTitle,
    platformSlug: platform.slug,
    storageKey,
    archiveSize: processed.size,
    checksumSha256: processed.sha256,
    uploadAuditId: audit.id,
  };
}

async function handleBiosUpload(
  app: FastifyInstance,
  metadata: UploadMetadata,
  processed: ProcessedUpload,
  storageKey: string,
  archiveMimeType: string,
  uploadedById: string | undefined,
  safeFilename: string,
): Promise<UploadResult> {
  const coreSlug = metadata.biosCore!;

  if (!app.storage.biosBucket) {
    throw app.httpErrors.badRequest("BIOS storage bucket is not configured");
  }

  const duplicate = await app.prisma.emulatorBios.findFirst({
    where: {
      coreSlug,
      checksumSha256: processed.sha256,
    },
  });

  if (duplicate) {
    const audit = await app.prisma.romUploadAudit.create({
      data: {
        kind: "BIOS",
        status: "FAILED",
        biosId: duplicate.id,
        uploadedById: uploadedById ?? null,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
        errorMessage: "Duplicate BIOS archive",
      },
    });

    return {
      status: "duplicate",
      metadata,
      biosId: duplicate.id,
      biosCore: coreSlug,
      reason: "Duplicate BIOS archive",
      uploadAuditId: audit.id,
    };
  }

  await app.storage.putBiosObject(storageKey, {
    filePath: processed.filePath,
    size: processed.size,
    sha256: processed.sha256,
    sha1: processed.sha1,
    md5: processed.md5,
    crc32: processed.crc32,
    contentType: archiveMimeType,
  });

  const { bios, audit } = await app.prisma.$transaction(async (tx) => {
    const biosRecord = await tx.emulatorBios.upsert({
      where: {
        coreSlug_originalFilename: {
          coreSlug,
          originalFilename: safeFilename,
        },
      },
      create: {
        coreSlug,
        region: metadata.biosRegion,
        originalFilename: safeFilename,
        storageKey,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
      },
      update: {
        region: metadata.biosRegion,
        storageKey,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
      },
    });

    const auditRecord = await tx.romUploadAudit.create({
      data: {
        kind: "BIOS",
        status: "SUCCEEDED",
        biosId: biosRecord.id,
        uploadedById: uploadedById ?? null,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed.size,
        checksumSha256: processed.sha256,
        checksumSha1: processed.sha1,
        checksumMd5: processed.md5,
        checksumCrc32: processed.crc32,
      },
    });

    return { bios: biosRecord, audit: auditRecord };
  });

  return {
    status: "success",
    metadata,
    biosId: bios.id,
    biosCore: coreSlug,
    storageKey,
    archiveSize: processed.size,
    checksumSha256: processed.sha256,
    uploadAuditId: audit.id,
  };
}

async function recordFailedAudit(
  app: FastifyInstance,
  metadata: UploadMetadata,
  storageKey: string,
  archiveMimeType: string,
  processed: ProcessedUpload | undefined,
  errorMessage: string,
  uploadedById: string | undefined,
  safeFilename: string,
): Promise<void> {
  try {
    await app.prisma.romUploadAudit.create({
      data: {
        kind: metadata.type === "rom" ? "ROM" : "BIOS",
        status: "FAILED",
        platformId:
          metadata.type === "rom"
            ? await lookupPlatformId(app, metadata.platformSlug)
            : null,
        uploadedById: uploadedById ?? null,
        storageKey,
        originalFilename: safeFilename,
        archiveMimeType,
        archiveSize: processed?.size ?? null,
        checksumSha256: processed?.sha256,
        checksumSha1: processed?.sha1,
        checksumMd5: processed?.md5,
        checksumCrc32: processed?.crc32,
        errorMessage,
      },
    });
  } catch (auditError) {
    app.log.error({ err: auditError }, "Failed to persist rom upload audit");
  }
}

async function lookupPlatformId(
  app: FastifyInstance,
  slug: string | undefined,
): Promise<string | null> {
  if (!slug) {
    return null;
  }

  const platform = await app.prisma.platform.findUnique({ where: { slug } });
  return platform ? platform.id : null;
}

async function persistUploadStream(
  stream: NodeJS.ReadableStream,
  safeFilename: string,
): Promise<ProcessedUpload> {
  const tempDir = await mkdtemp(`${tmpdir()}/treaz-rom-`);
  const tempPath = `${tempDir}/${randomUUID()}-${safeFilename}`;
  const writeStream = createWriteStream(tempPath);
  const sha256 = createHash("sha256");
  const sha1 = createHash("sha1");
  const md5 = createHash("md5");
  const crc = new Crc32();

  let size = 0;

  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > env.ROM_UPLOAD_MAX_BYTES) {
        throw new Error("Archive exceeds maximum allowed size");
      }

      sha256.update(buffer);
      sha1.update(buffer);
      md5.update(buffer);
      crc.update(buffer);

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
    md5: md5.digest("hex"),
    crc32: crc.digest().toString(16).padStart(8, "0"),
  };
}

function sanitizeFilename(filename: string): string {
  const base = pathPosix.basename(filename);
  const sanitized = base.replace(/[\u0000-\u001f<>:"|?*\\/]+/g, "_");
  return sanitized.length > 0 ? sanitized : "archive.zip";
}

function buildStorageKey(
  metadata: UploadMetadata,
  safeFilename: string,
): string {
  if (metadata.type === "rom") {
    return pathPosix.join("roms", metadata.platformSlug!, safeFilename);
  }
  return pathPosix.join("bios", metadata.biosCore!, safeFilename);
}

function deriveRomTitle(metadata: UploadMetadata): string {
  if (metadata.romTitle && metadata.romTitle.trim().length > 0) {
    return metadata.romTitle.trim();
  }

  const filename = sanitizeFilename(metadata.originalFilename);
  return filename.replace(/\.[^.]+$/, "");
}

type UploadOutcomeLabels = {
  kind: "rom" | "bios";
  status: string;
  reason: string | undefined;
};

function normalizeUploadReason(reason: string | undefined): string {
  if (!reason) {
    return "unknown";
  }

  const normalized = reason
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "unknown";
}

function recordUploadOutcome(
  app: FastifyInstance,
  startedAt: bigint,
  labels: UploadOutcomeLabels,
): void {
  if (!app.metrics.enabled) {
    return;
  }

  const normalizedReason = normalizeUploadReason(labels.reason);
  app.metrics.uploads.inc({
    kind: labels.kind,
    status: labels.status,
    reason: normalizedReason,
  });

  const durationSeconds =
    Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  app.metrics.uploadDuration.observe(
    { kind: labels.kind, status: labels.status },
    durationSeconds,
  );
}

function deriveUploadFailureReason(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "validation_error";
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : "unknown";

  if (message.includes("maximum allowed size")) {
    return "archive_too_large";
  }
  if (message.includes("binary payload is required")) {
    return "missing_payload";
  }
  if (message.includes("upload metadata")) {
    return "invalid_metadata";
  }
  if (message.includes("unknown platform")) {
    return "unknown_platform";
  }
  if (message.includes("duplicate")) {
    return "duplicate";
  }
  if ((error as { code?: string }).code === "EPIPE") {
    return "stream_interrupted";
  }

  return "unexpected_error";
}
