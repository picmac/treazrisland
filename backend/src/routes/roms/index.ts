import Busboy from "busboy";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { posix as pathPosix } from "node:path";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  safeUnlink,
  stageUploadStream,
  type StagedUpload,
} from "../../services/storage/storage.js";

type UploadMultipartFile = {
  stream: NodeJS.ReadableStream;
  filename: string;
  mimeType: string;
};

const uploadFormSchema = z.object({
  platformSlug: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9][a-z0-9-_]*$/i,
      "platformSlug must be alphanumeric with dashes or underscores",
    ),
  title: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

type ParsedUploadForm = {
  fields: UploadFormData;
  file: UploadMultipartFile | null;
};

const MULTIPART_ERROR_CODES = {
  tooManyFiles: "ROM_UPLOAD_TOO_MANY_FILES",
  tooLarge: "ROM_UPLOAD_TOO_LARGE",
} as const;

async function parseUploadForm(
  request: FastifyRequest,
): Promise<ParsedUploadForm> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: env.ROM_UPLOAD_MAX_BYTES,
      },
    });

    const fieldValues: Record<string, string> = {};
    let file: UploadMultipartFile | null = null;
    let parseFailed = false;
    let deferredError: Error | null = null;

    const source = Buffer.isBuffer(request.body)
      ? Readable.from(request.body)
      : request.raw;

    const rejectOnce = (error: Error) => {
      if (parseFailed) {
        return;
      }
      parseFailed = true;
      reject(error);
      if (typeof (source as NodeJS.ReadableStream).unpipe === "function") {
        (source as NodeJS.ReadableStream).unpipe(busboy);
      }
      if (typeof (source as NodeJS.ReadableStream).resume === "function") {
        (source as NodeJS.ReadableStream).resume();
      }
    };

    busboy.on("file", (fieldname, fileStream, info) => {
      if (fieldname !== "file" && fieldname !== "rom") {
        fileStream.resume();
        return;
      }

      if (file) {
        fileStream.resume();
        const error = new Error("Only one ROM archive may be uploaded");
        (error as Error & { code: string }).code = MULTIPART_ERROR_CODES.tooManyFiles;
        rejectOnce(error);
        return;
      }

      const stream = new PassThrough();
      fileStream.pipe(stream);

      fileStream.on("limit", () => {
        const error = new Error("ROM archive exceeds maximum allowed size");
        (error as Error & { code: string }).code = MULTIPART_ERROR_CODES.tooLarge;
        deferredError = error;
        stream.destroy(error);
      });

      fileStream.once("error", (error) => {
        deferredError = error instanceof Error ? error : new Error(String(error));
        stream.destroy(deferredError);
      });

      file = {
        stream,
        filename: info.filename ?? "upload.bin",
        mimeType: info.mimeType ?? "application/octet-stream",
      };
    });

    busboy.on("field", (fieldname, value) => {
      fieldValues[fieldname] = value;
    });

    busboy.once("filesLimit", () => {
      const error = new Error("Only one ROM archive may be uploaded");
      (error as Error & { code: string }).code = MULTIPART_ERROR_CODES.tooManyFiles;
      rejectOnce(error);
    });

    busboy.once("error", (error) => {
      rejectOnce(error instanceof Error ? error : new Error(String(error)));
    });

    busboy.once("finish", () => {
      if (parseFailed) {
        return;
      }

      if (deferredError) {
        rejectOnce(deferredError);
        return;
      }

      const parsed = uploadFormSchema.safeParse(fieldValues);
      if (!parsed.success) {
        rejectOnce(parsed.error);
        return;
      }

      resolve({ fields: parsed.data, file });
    });

    (source as NodeJS.ReadableStream).pipe(busboy);
  });
}

function sanitizeFilename(filename: string): string {
  const base = pathPosix.basename(filename);
  const sanitized = base.replace(/[\u0000-\u001f<>:"|?*\\/]+/g, "_");
  return sanitized.length > 0 ? sanitized : "archive.zip";
}

function deriveRomTitle(form: UploadFormData, filename: string): string {
  if (form.title && form.title.trim().length > 0) {
    return form.title.trim();
  }

  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.length > 0 ? withoutExtension : "Untitled ROM";
}

async function ensurePlatform(app: FastifyInstance, slug: string) {
  const platform = await app.prisma.platform.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
    },
  });

  if (!platform) {
    throw app.httpErrors.notFound("Platform not found");
  }

  return platform;
}

export async function registerRomRoutes(app: FastifyInstance): Promise<void> {
  if (!app.hasContentTypeParser("multipart/form-data")) {
    try {
      app.addContentTypeParser(/^(multipart\/form-data)(;.*)?$/i, (request, payload, done) => {
        done(null, payload);
      });
    } catch (error) {
      if (!((error as Error & { code?: string }).code === "FST_ERR_CTP_ALREADY_PRESENT")) {
        throw error;
      }
    }
  }

  app.post(
    "/roms/uploads",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = await parseUploadForm(request);
      const file = parsed.file;

      if (!file) {
        return reply.status(400).send({ message: "ROM archive is required" });
      }

      const platform = await ensurePlatform(app, parsed.fields.platformSlug);
      const safeFilename = sanitizeFilename(file.filename);
      let staged: StagedUpload;

      try {
        staged = await stageUploadStream(file.stream, {
          filename: safeFilename,
          maxBytes: env.ROM_UPLOAD_MAX_BYTES,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error as Error & { code?: string }).code === MULTIPART_ERROR_CODES.tooLarge
        ) {
          throw app.httpErrors.payloadTooLarge(
            "ROM archive exceeds maximum allowed size",
          );
        }
        throw error;
      }

      if (staged.size === 0) {
        await safeUnlink(staged.filePath);
        return reply.status(400).send({ message: "ROM archive is empty" });
      }

      const duplicate = await app.prisma.romBinary.findFirst({
        where: {
          checksumSha256: staged.sha256,
          rom: { platformId: platform.id },
        },
        include: { rom: true },
      });

      if (duplicate) {
        await app.prisma.romUploadAudit.create({
          data: {
            kind: "ROM",
            status: "FAILED",
            romId: duplicate.romId,
            romBinaryId: duplicate.id,
            platformId: platform.id,
            uploadedById: request.user?.sub ?? null,
            storageKey: duplicate.storageKey,
            originalFilename: safeFilename,
            archiveMimeType: file.mimeType,
            archiveSize: staged.size,
            checksumSha256: staged.sha256,
            checksumSha1: staged.sha1,
            checksumMd5: staged.md5,
            checksumCrc32: staged.crc32,
            errorMessage: "Duplicate ROM detected",
          },
        });

        await safeUnlink(staged.filePath);
        return reply.status(409).send({
          message: "ROM archive already exists for this platform",
          romId: duplicate.romId,
        });
      }

      const storageKey = pathPosix.join(
        "roms",
        platform.slug,
        `${randomUUID()}-${safeFilename}`,
      );

      await app.storage.putRomObject(storageKey, {
        filePath: staged.filePath,
        size: staged.size,
        sha256: staged.sha256,
        sha1: staged.sha1,
        md5: staged.md5,
        crc32: staged.crc32,
        contentType: file.mimeType,
        metadata: {
          platformId: platform.id,
          uploaderId: request.user?.sub,
        },
      });

      const romTitle = deriveRomTitle(parsed.fields, safeFilename);
      const now = new Date();

      const { rom, binary, audit } = await app.prisma.$transaction(async (tx) => {
        const existing = await tx.rom.findFirst({
          where: { platformId: platform.id, title: romTitle },
        });

        const romRecord = existing
          ? await tx.rom.update({
              where: { id: existing.id },
              data: {
                romHash: staged!.sha256,
                romSize: staged!.size,
                updatedAt: now,
              },
            })
          : await tx.rom.create({
              data: {
                platformId: platform.id,
                title: romTitle,
                romHash: staged!.sha256,
                romSize: staged!.size,
              },
            });

        const binaryRecord = await tx.romBinary.upsert({
          where: { romId: romRecord.id },
          create: {
            romId: romRecord.id,
            storageKey,
            originalFilename: safeFilename,
            archiveMimeType: file.mimeType,
            archiveSize: staged!.size,
            checksumSha256: staged!.sha256,
            checksumSha1: staged!.sha1,
            checksumMd5: staged!.md5,
            checksumCrc32: staged!.crc32,
            status: "READY",
          },
          update: {
            storageKey,
            archiveMimeType: file.mimeType,
            archiveSize: staged!.size,
            checksumSha256: staged!.sha256,
            checksumSha1: staged!.sha1,
            checksumMd5: staged!.md5,
            checksumCrc32: staged!.crc32,
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
            uploadedById: request.user?.sub ?? null,
            storageKey,
            originalFilename: safeFilename,
            archiveMimeType: file.mimeType,
            archiveSize: staged!.size,
            checksumSha256: staged!.sha256,
            checksumSha1: staged!.sha1,
            checksumMd5: staged!.md5,
            checksumCrc32: staged!.crc32,
          },
        });

        return { rom: romRecord, binary: binaryRecord, audit: auditRecord };
      });

      const signedUrl = await app.storage.getRomObjectSignedUrl(storageKey, {
        expiresInSeconds: 300,
      });

      await safeUnlink(staged.filePath);

      request.log.info(
        {
          event: "rom.upload.user",
          romId: rom.id,
          platformId: platform.id,
          binaryId: binary.id,
          uploadAuditId: audit.id,
        },
        "ROM archive uploaded",
      );

      return reply.status(201).send({
        upload: {
          romId: rom.id,
          title: rom.title,
          platform,
          binaryId: binary.id,
          storageKey,
          size: staged.size,
          checksumSha256: staged.sha256,
          checksumSha1: staged.sha1,
          checksumMd5: staged.md5,
          checksumCrc32: staged.crc32,
          signedUrl: signedUrl?.url ?? null,
          signedUrlExpiresAt: signedUrl?.expiresAt
            ? signedUrl.expiresAt.toISOString()
            : null,
          uploadAuditId: audit.id,
        },
      });
    },
  );
}
