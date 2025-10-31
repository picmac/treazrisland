import type { FastifyInstance, FastifyRequest } from "fastify";
import Busboy from "busboy";
import { PassThrough, Readable } from "node:stream";
import { z } from "zod";
import prisma from "@prisma/client";
import type { Prisma as PrismaNamespace } from "@prisma/client";
import { env } from "../config/env.js";
import type { AvatarUploadResult } from "../services/storage/storage.js";

const { Prisma } = prisma;

const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Nickname must be at least 3 characters")
  .max(32, "Nickname must be at most 32 characters");

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name must be at least 1 character")
  .max(64, "Display name must be at most 64 characters");

const jsonPatchSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    displayName: displayNameSchema.optional(),
    removeAvatar: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.nickname !== undefined ||
      value.displayName !== undefined ||
      value.removeAvatar === true,
    {
      message: "At least one field must be provided",
    },
  );

const formPatchSchema = z.object({
  nickname: nicknameSchema.optional(),
  displayName: displayNameSchema.optional(),
  removeAvatar: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => {
      if (value === "true" || value === "1" || value === "on") {
        return true;
      }
      if (value === "false" || value === "0" || value === "off" || value === "") {
        return false;
      }
      throw new Error("removeAvatar must be true or false");
    })
    .optional(),
});

const userProfileSelect = {
  id: true,
  email: true,
  nickname: true,
  displayName: true,
  role: true,
  avatarStorageKey: true,
  avatarMimeType: true,
  avatarFileSize: true,
  avatarUpdatedAt: true,
} as const;

type SelectedUserProfile = PrismaNamespace.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

async function serializeUserProfile(
  app: FastifyInstance,
  user: SelectedUserProfile,
) {
  const avatar = await buildAvatarMetadata(app, user);
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    displayName: user.displayName,
    role: user.role,
    avatar,
  };
}

async function buildAvatarMetadata(
  app: FastifyInstance,
  user: Pick<
    SelectedUserProfile,
    "avatarStorageKey" | "avatarMimeType" | "avatarFileSize" | "avatarUpdatedAt"
  >,
) {
  if (!user.avatarStorageKey) {
    return null;
  }

  let signedUrl: Awaited<
    ReturnType<FastifyInstance["storage"]["getAssetObjectSignedUrl"]>
  > | null = null;
  try {
    signedUrl = await app.storage.getAssetObjectSignedUrl(
      user.avatarStorageKey,
      { expiresInSeconds: 300 },
    );
  } catch (error) {
    app.log.warn({ err: error, key: user.avatarStorageKey }, "Failed to sign avatar URL");
  }

  const version = user.avatarUpdatedAt
    ? user.avatarUpdatedAt.getTime()
    : Date.now();
  const fallbackPath = `/users/me/avatar?v=${version}`;

  return {
    storageKey: user.avatarStorageKey,
    mimeType: user.avatarMimeType ?? null,
    fileSize: user.avatarFileSize ?? null,
    updatedAt: user.avatarUpdatedAt?.toISOString() ?? null,
    url: signedUrl?.url ?? fallbackPath,
    signedUrlExpiresAt: signedUrl?.expiresAt
      ? signedUrl.expiresAt.toISOString()
      : null,
    fallbackPath,
  } as const;
}

type AvatarMultipartFile = {
  stream: NodeJS.ReadableStream;
  filename: string;
  mimetype: string;
};

type MultipartParseResult = {
  fields: z.infer<typeof formPatchSchema>;
  avatarFile: AvatarMultipartFile | null;
};

const MULTIPART_ERROR_CODES = {
  avatarTooLarge: "AVATAR_FILE_TOO_LARGE",
  duplicateAvatar: "AVATAR_DUPLICATE",
} as const;

async function parseMultipartPayload(
  request: FastifyRequest,
): Promise<MultipartParseResult> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: env.USER_AVATAR_MAX_BYTES,
        files: 1,
      },
    });

    const fieldValues: Record<string, string> = {};
    let avatarFile: AvatarMultipartFile | null = null;
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

    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "avatar") {
        file.resume();
        return;
      }

      if (avatarFile) {
        file.resume();
        const error = new Error("Only one avatar file may be uploaded");
        (error as Error & { code: string }).code =
          MULTIPART_ERROR_CODES.duplicateAvatar;
        rejectOnce(error);
        return;
      }

      const stream = new PassThrough();
      file.pipe(stream);

      file.on("limit", () => {
        const error = new Error("Avatar exceeds maximum allowed size");
        (error as Error & { code: string }).code =
          MULTIPART_ERROR_CODES.avatarTooLarge;
        deferredError = error;
        stream.destroy(error);
      });

      file.once("error", (error) => {
        deferredError = error instanceof Error ? error : new Error(String(error));
        stream.destroy(deferredError);
      });

      avatarFile = {
        stream,
        filename: info.filename,
        mimetype: info.mimeType ?? "application/octet-stream",
      };
    });

    busboy.on("field", (fieldname, value) => {
      fieldValues[fieldname] = value;
    });

    busboy.once("filesLimit", () => {
      const error = new Error("Only one avatar file may be uploaded");
      (error as Error & { code: string }).code =
        MULTIPART_ERROR_CODES.duplicateAvatar;
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

      const parsed = formPatchSchema.safeParse(fieldValues);
      if (!parsed.success) {
        rejectOnce(parsed.error);
        return;
      }

      resolve({ fields: parsed.data, avatarFile });
    });

    (source as NodeJS.ReadableStream).pipe(busboy);
  });
}

function normalizePrismaError(error: unknown, app: FastifyInstance): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw app.httpErrors.conflict("Nickname is already in use");
  }

  throw error;
}

function mapAvatarUploadError(error: unknown, app: FastifyInstance): never {
  if (error instanceof Error) {
    if (
      error.message.includes("Avatar") ||
      error.message.includes("avatar") ||
      error.message.includes("Unsupported")
    ) {
      throw app.httpErrors.badRequest(error.message);
    }
  }

  throw error;
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.addContentTypeParser(/^(multipart\/form-data)(;.*)?$/i, (request, payload, done) => {
    done(null, payload);
  });

  app.get(
    "/users/me",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const user = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
        select: userProfileSelect,
      });

      if (!user) {
        throw app.httpErrors.notFound("User not found");
      }

      const [profile, activeMfa] = await Promise.all([
        serializeUserProfile(app, user),
        app.prisma.mfaSecret.findFirst({
          where: { userId: user.id, disabledAt: null, confirmedAt: { not: null } }
        })
      ]);

      return { user: { ...profile, mfaEnabled: Boolean(activeMfa) } };
    },
  );

  app.get(
    "/users/me/avatar",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const user = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
        select: userProfileSelect,
      });

      if (!user || !user.avatarStorageKey) {
        throw app.httpErrors.notFound("Avatar not found");
      }

      const signedUrl = await app.storage.getAssetObjectSignedUrl(
        user.avatarStorageKey,
        { expiresInSeconds: 300 },
      );

      if (signedUrl) {
        reply.header("cache-control", "private, max-age=60");
        return reply.redirect(signedUrl.url);
      }

      const object = await app.storage.getAssetObjectStream(
        user.avatarStorageKey,
      );

      reply.header("cache-control", "private, max-age=60");
      if (user.avatarMimeType) {
        reply.header("content-type", user.avatarMimeType);
      } else if (object.contentType) {
        reply.header("content-type", object.contentType);
      }
      const contentLength =
        user.avatarFileSize ?? object.contentLength ?? undefined;
      if (contentLength) {
        reply.header("content-length", String(contentLength));
      }

      return reply.send(object.stream);
    },
  );

  app.patch(
    "/users/me",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      let avatarFile: AvatarMultipartFile | null = null;
      let payload: z.infer<typeof jsonPatchSchema> | null = null;

      const contentTypeHeader = request.headers["content-type"];
      if (
        typeof contentTypeHeader === "string" &&
        contentTypeHeader.toLowerCase().includes("multipart/form-data")
      ) {
        try {
          const parsed = await parseMultipartPayload(request);
          avatarFile = parsed.avatarFile;
          payload = {
            nickname: parsed.fields.nickname,
            displayName: parsed.fields.displayName,
            removeAvatar: parsed.fields.removeAvatar ?? false,
          };
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              message: "Invalid payload",
              errors: error.flatten().fieldErrors,
            });
          }
          if (
            error instanceof Error &&
            (error as Error & { code?: string }).code ===
              MULTIPART_ERROR_CODES.avatarTooLarge
          ) {
            throw app.httpErrors.payloadTooLarge(
              "Avatar exceeds maximum allowed size",
            );
          }
          if (
            error instanceof Error &&
            (error as Error & { code?: string }).code ===
              MULTIPART_ERROR_CODES.duplicateAvatar
          ) {
            throw app.httpErrors.badRequest(error.message);
          }
          throw error;
        }
      } else {
        const parsed = jsonPatchSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.status(400).send({
            message: "Invalid payload",
            errors: parsed.error.flatten().fieldErrors,
          });
        }
        payload = parsed.data;
      }

      if (!payload) {
        throw app.httpErrors.badRequest("No changes provided");
      }

      const removeAvatar = payload.removeAvatar === true;
      if (removeAvatar && avatarFile) {
        throw app.httpErrors.badRequest(
          "Cannot upload a new avatar and remove the current avatar simultaneously",
        );
      }

      if (
        payload.nickname === undefined &&
        payload.displayName === undefined &&
        !avatarFile &&
        !removeAvatar
      ) {
        throw app.httpErrors.badRequest("No changes provided");
      }

      const currentUser = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
        select: userProfileSelect,
      });

      if (!currentUser) {
        throw app.httpErrors.notFound("User not found");
      }

      let uploadedAvatar: AvatarUploadResult | null = null;
      try {
        if (avatarFile) {
          uploadedAvatar = await app.storage.uploadUserAvatar({
            userId: currentUser.id,
            stream: avatarFile.stream,
            maxBytes: env.USER_AVATAR_MAX_BYTES,
            contentType: avatarFile.mimetype,
          });
        }
      } catch (error) {
        mapAvatarUploadError(error, app);
      }

      const data: import("@prisma/client").Prisma.UserUpdateInput = {};
      if (payload.nickname !== undefined) {
        data.nickname = payload.nickname;
      }
      if (payload.displayName !== undefined) {
        data.displayName = payload.displayName;
      }
      if (uploadedAvatar) {
        data.avatarStorageKey = uploadedAvatar.storageKey;
        data.avatarMimeType = uploadedAvatar.contentType;
        data.avatarFileSize = uploadedAvatar.size;
        data.avatarUpdatedAt = new Date();
      } else if (removeAvatar) {
        data.avatarStorageKey = null;
        data.avatarMimeType = null;
        data.avatarFileSize = null;
        data.avatarUpdatedAt = null;
      }

      let updatedUser: SelectedUserProfile;
      try {
        updatedUser = await app.prisma.user.update({
          where: { id: currentUser.id },
          data,
          select: userProfileSelect,
        });
      } catch (error) {
        if (uploadedAvatar) {
          try {
            await app.storage.deleteAssetObject(uploadedAvatar.storageKey);
          } catch (cleanupError) {
            request.log.error(
              { err: cleanupError, key: uploadedAvatar.storageKey },
              "Failed to clean up avatar after update failure",
            );
          }
        }
        normalizePrismaError(error, app);
      }

      if (uploadedAvatar && currentUser.avatarStorageKey) {
        void app.storage.deleteAssetObject(currentUser.avatarStorageKey).catch(
          (error) => {
            request.log.warn(
              { err: error, key: currentUser.avatarStorageKey },
              "Failed to remove previous avatar",
            );
          },
        );
      } else if (removeAvatar && currentUser.avatarStorageKey) {
        void app.storage.deleteAssetObject(currentUser.avatarStorageKey).catch(
          (error) => {
            request.log.warn(
              { err: error, key: currentUser.avatarStorageKey },
              "Failed to remove previous avatar",
            );
          },
        );
      }

      const [profile, activeMfa] = await Promise.all([
        serializeUserProfile(app, updatedUser),
        app.prisma.mfaSecret.findFirst({
          where: { userId: updatedUser.id, disabledAt: null, confirmedAt: { not: null } }
        })
      ]);

      return { user: { ...profile, mfaEnabled: Boolean(activeMfa) } };
    },
  );
}
