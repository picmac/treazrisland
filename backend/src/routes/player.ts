import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RomBinaryStatus, type PlayState, type Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { safeUnlink } from "../services/storage/storage.js";

const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

const ROM_PLAYBACK_ACTIONS = {
  ROM_DOWNLOAD: "ROM_DOWNLOAD",
  ASSET_DOWNLOAD: "ASSET_DOWNLOAD",
  PLAY_STATE_DOWNLOAD: "PLAY_STATE_DOWNLOAD",
  PLAY_STATE_UPLOAD: "PLAY_STATE_UPLOAD",
} satisfies Record<string, Prisma.RomPlaybackAction>;

const playStateSchema = z.object({
  romId: z.string().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  slot: z.number().int().min(0).max(99).optional(),
  data: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .refine((value) => value.length > 0, {
      message: "data must not be empty",
    })
    .refine((value) => BASE64_REGEX.test(value), {
      message: "data must be base64-encoded",
    }),
});

const updatePlayStateSchema = playStateSchema
  .partial({ romId: true })
  .refine(
    (value) =>
      value.label !== undefined ||
      value.slot !== undefined ||
      value.data !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

const listPlayStatesQuery = z.object({
  romId: z.string().min(1).optional(),
});

function createRoleAwareRateLimit(app: FastifyInstance) {
  return app.rateLimit({
    hook: "preHandler",
    timeWindow: 60_000,
    max: (request) => (request.user?.role === "ADMIN" ? 120 : 30),
  });
}

function buildPlayStateDownloadPath(id: string): string {
  return `/player/play-states/${id}/binary`;
}

function serializePlayState(playState: PlayState) {
  return {
    id: playState.id,
    romId: playState.romId,
    label: playState.label,
    slot: playState.slot,
    size: playState.size,
    checksumSha256: playState.checksumSha256,
    createdAt: playState.createdAt,
    updatedAt: playState.updatedAt,
    downloadUrl: buildPlayStateDownloadPath(playState.id),
  };
}

type PlaybackAuditContext = {
  romId?: string | null;
  romBinaryId?: string | null;
  assetId?: string | null;
  playStateId?: string | null;
};

async function logPlaybackAudit(
  app: FastifyInstance,
  request: FastifyRequest,
  data: Prisma.RomPlaybackAuditCreateInput,
  context: PlaybackAuditContext,
) {
  try {
    await app.prisma.romPlaybackAudit.create({ data });
    app.metrics.playback.inc({
      action: data.action.toLowerCase(),
      status: "recorded",
    });
    request.log.info(
      {
        event: "player.activity",
        action: data.action,
        romId: context.romId ?? null,
        romBinaryId: context.romBinaryId ?? null,
        assetId: context.assetId ?? null,
        playStateId: context.playStateId ?? null,
        userId: request.user?.sub ?? null,
      },
      "Playback event recorded",
    );
  } catch (err) {
    app.metrics.playback.inc({
      action: data.action.toLowerCase(),
      status: "failed",
    });
    app.log.warn(
      { err, action: data.action, context },
      "Failed to record playback audit entry",
    );
  }
}

async function removePlayState(
  app: FastifyInstance,
  playState: Pick<PlayState, "id" | "storageKey">,
) {
  try {
    await app.storage.deleteAssetObject(playState.storageKey);
  } catch (err) {
    app.log.warn(
      { err, playStateId: playState.id },
      "Failed to delete play-state object",
    );
  }

  try {
    await app.prisma.playState.delete({ where: { id: playState.id } });
  } catch (err) {
    app.log.warn(
      { err, playStateId: playState.id },
      "Failed to delete play-state record",
    );
  }
}

export async function registerPlayerRoutes(
  app: FastifyInstance,
): Promise<void> {
  const rateLimitHook = createRoleAwareRateLimit(app);

  app.get(
    "/player/roms/:id/binary",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const rom = await app.prisma.rom.findUnique({
        where: { id: params.id },
        include: {
          binary: true,
        },
      });

      if (!rom || !rom.binary || rom.binary.status !== RomBinaryStatus.READY) {
        throw app.httpErrors.notFound("ROM binary is not available");
      }

      await logPlaybackAudit(
        app,
        request,
        {
          action: ROM_PLAYBACK_ACTIONS.ROM_DOWNLOAD,
          rom: { connect: { id: rom.id } },
          romBinary: { connect: { id: rom.binary.id } },
          user: request.user
            ? { connect: { id: request.user.sub } }
            : undefined,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        { romId: rom.id, romBinaryId: rom.binary.id },
      );

      const signedUrl = await app.storage.getRomObjectSignedUrl(
        rom.binary.storageKey,
      );
      if (signedUrl) {
        return {
          type: "signed-url" as const,
          url: signedUrl.url,
          expiresAt: signedUrl.expiresAt.toISOString(),
          size: rom.binary.archiveSize,
          contentType: rom.binary.archiveMimeType ?? "application/octet-stream",
        };
      }

      const object = await app.storage.getRomObjectStream(
        rom.binary.storageKey,
      );
      reply.header(
        "content-type",
        rom.binary.archiveMimeType ??
          object.contentType ??
          "application/octet-stream",
      );
      if ((object.contentLength ?? rom.binary.archiveSize) > 0) {
        reply.header(
          "content-length",
          String(object.contentLength ?? rom.binary.archiveSize),
        );
      }

      return reply.send(object.stream);
    },
  );

  app.get(
    "/rom-assets/:assetId",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request, reply) => {
      const params = z
        .object({ assetId: z.string().min(1) })
        .parse(request.params);
      const asset = await app.prisma.romAsset.findUnique({
        where: { id: params.assetId },
        select: {
          id: true,
          romId: true,
          storageKey: true,
          externalUrl: true,
          format: true,
          fileSize: true,
        },
      });

      if (!asset) {
        throw app.httpErrors.notFound("Asset not found");
      }

      if (asset.externalUrl) {
        await logPlaybackAudit(
          app,
          request,
          {
            action: ROM_PLAYBACK_ACTIONS.ASSET_DOWNLOAD,
            rom: asset.romId ? { connect: { id: asset.romId } } : undefined,
            romAsset: { connect: { id: asset.id } },
            user: request.user
              ? { connect: { id: request.user.sub } }
              : undefined,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          { romId: asset.romId ?? null, assetId: asset.id },
        );
        return { type: "external" as const, url: asset.externalUrl };
      }

      if (!asset.storageKey) {
        throw app.httpErrors.notFound("Asset is not stored locally");
      }

      await logPlaybackAudit(
        app,
        request,
        {
          action: ROM_PLAYBACK_ACTIONS.ASSET_DOWNLOAD,
          rom: asset.romId ? { connect: { id: asset.romId } } : undefined,
          romAsset: { connect: { id: asset.id } },
          user: request.user
            ? { connect: { id: request.user.sub } }
            : undefined,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        { romId: asset.romId ?? null, assetId: asset.id },
      );

      const signedUrl = await app.storage.getAssetObjectSignedUrl(
        asset.storageKey,
      );
      if (signedUrl) {
        return {
          type: "signed-url" as const,
          url: signedUrl.url,
          expiresAt: signedUrl.expiresAt.toISOString(),
          size: asset.fileSize ?? null,
          format: asset.format ?? null,
        };
      }

      const object = await app.storage.getAssetObjectStream(asset.storageKey);
      if (asset.fileSize) {
        reply.header("content-length", String(asset.fileSize));
      } else if (object.contentLength) {
        reply.header("content-length", String(object.contentLength));
      }
      if (asset.format) {
        reply.header("content-type", `application/${asset.format}`);
      }

      return reply.send(object.stream);
    },
  );

  app.get(
    "/player/play-states",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const query = listPlayStatesQuery.parse(request.query ?? {});
      const playStates = await app.prisma.playState.findMany({
        where: {
          userId: request.user.sub,
          ...(query.romId ? { romId: query.romId } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });

      return { playStates: playStates.map(serializePlayState) };
    },
  );

  app.get(
    "/player/play-states/:id",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const playState = await app.prisma.playState.findUnique({
        where: { id: params.id },
      });

      if (!playState || playState.userId !== request.user.sub) {
        throw app.httpErrors.notFound("Play state not found");
      }

      return serializePlayState(playState);
    },
  );

  app.get(
    "/player/play-states/:id/binary",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const playState = await app.prisma.playState.findUnique({
        where: { id: params.id },
      });

      if (!playState || playState.userId !== request.user.sub) {
        throw app.httpErrors.notFound("Play state not found");
      }

      await logPlaybackAudit(
        app,
        request,
        {
          action: ROM_PLAYBACK_ACTIONS.PLAY_STATE_DOWNLOAD,
          rom: { connect: { id: playState.romId } },
          playState: { connect: { id: playState.id } },
          user: { connect: { id: request.user.sub } },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        { romId: playState.romId, playStateId: playState.id },
      );

      const signedUrl = await app.storage.getAssetObjectSignedUrl(
        playState.storageKey,
      );
      if (signedUrl) {
        return {
          type: "signed-url" as const,
          url: signedUrl.url,
          expiresAt: signedUrl.expiresAt.toISOString(),
          size: playState.size,
        };
      }

      const object = await app.storage.getAssetObjectStream(
        playState.storageKey,
      );
      reply.header("content-type", "application/octet-stream");
      reply.header(
        "content-length",
        String(object.contentLength ?? playState.size),
      );

      return reply.send(object.stream);
    },
  );

  app.post(
    "/player/play-states",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const body = playStateSchema.parse(request.body ?? {});

      const rom = await app.prisma.rom.findUnique({
        where: { id: body.romId },
        select: { id: true },
      });

      if (!rom) {
        throw app.httpErrors.notFound("ROM not found");
      }

      const buffer = Buffer.from(body.data, "base64");
      if (buffer.byteLength > env.PLAY_STATE_MAX_BYTES) {
        throw app.httpErrors.badRequest(
          `Save state exceeds ${env.PLAY_STATE_MAX_BYTES} bytes limit`,
        );
      }

      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const playStateId = randomUUID();
      const storageKey = `play-states/${request.user.sub}/${rom.id}/${playStateId}.bin`;
      const tempPath = join(tmpdir(), `treaz-play-state-${playStateId}.bin`);

      await writeFile(tempPath, buffer);
      try {
        await app.storage.putObject(app.storage.assetBucket, storageKey, {
          filePath: tempPath,
          size: buffer.byteLength,
          sha256,
          contentType: "application/octet-stream",
        });
      } finally {
        await safeUnlink(tempPath);
      }

      if (typeof body.slot === "number") {
        const existing = await app.prisma.playState.findFirst({
          where: { userId: request.user.sub, romId: rom.id, slot: body.slot },
          select: { id: true, storageKey: true },
        });
        if (existing) {
          await removePlayState(app, existing);
        }
      }

      const playState = await app.prisma.playState.create({
        data: {
          id: playStateId,
          userId: request.user.sub,
          romId: rom.id,
          storageKey,
          label: body.label,
          slot: body.slot,
          size: buffer.byteLength,
          checksumSha256: sha256,
        },
      });

      const statesForUser = await app.prisma.playState.findMany({
        where: { userId: request.user.sub, romId: rom.id },
        orderBy: { updatedAt: "asc" },
        select: { id: true, storageKey: true },
      });

      if (statesForUser.length > env.PLAY_STATE_MAX_PER_ROM) {
        const overflow = statesForUser.slice(
          0,
          statesForUser.length - env.PLAY_STATE_MAX_PER_ROM,
        );
        for (const state of overflow) {
          if (state.id === playState.id) {
            continue;
          }
          await removePlayState(app, state);
        }
      }

      await logPlaybackAudit(
        app,
        request,
        {
          action: ROM_PLAYBACK_ACTIONS.PLAY_STATE_UPLOAD,
          rom: { connect: { id: playState.romId } },
          playState: { connect: { id: playState.id } },
          user: { connect: { id: request.user.sub } },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        { romId: playState.romId, playStateId: playState.id },
      );

      reply.code(201);
      return serializePlayState(playState);
    },
  );

  app.patch(
    "/player/play-states/:id",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = updatePlayStateSchema.parse(request.body ?? {});

      const playState = await app.prisma.playState.findUnique({
        where: { id: params.id },
      });

      if (!playState || playState.userId !== request.user.sub) {
        throw app.httpErrors.notFound("Play state not found");
      }

      const updateData: Prisma.PlayStateUpdateInput = {};

      if (body.label !== undefined) {
        updateData.label = body.label;
      }
      if (body.slot !== undefined) {
        updateData.slot = body.slot;
      }

      if (body.data !== undefined) {
        const buffer = Buffer.from(body.data, "base64");
        if (buffer.byteLength > env.PLAY_STATE_MAX_BYTES) {
          throw app.httpErrors.badRequest(
            `Save state exceeds ${env.PLAY_STATE_MAX_BYTES} bytes limit`,
          );
        }
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        const tempPath = join(tmpdir(), `treaz-play-state-${playState.id}.bin`);
        await writeFile(tempPath, buffer);
        try {
          await app.storage.putObject(
            app.storage.assetBucket,
            playState.storageKey,
            {
              filePath: tempPath,
              size: buffer.byteLength,
              sha256,
              contentType: "application/octet-stream",
            },
          );
        } finally {
          await safeUnlink(tempPath);
        }
        updateData.size = buffer.byteLength;
        updateData.checksumSha256 = sha256;
      }

      if (body.slot !== undefined) {
        const existing = await app.prisma.playState.findFirst({
          where: {
            userId: request.user.sub,
            romId: playState.romId,
            slot: body.slot,
            NOT: { id: playState.id },
          },
          select: { id: true, storageKey: true },
        });
        if (existing) {
          await removePlayState(app, existing);
        }
      }

      const updated = await app.prisma.playState.update({
        where: { id: playState.id },
        data: updateData,
      });

      if (body.data !== undefined) {
        await logPlaybackAudit(
          app,
          request,
          {
            action: ROM_PLAYBACK_ACTIONS.PLAY_STATE_UPLOAD,
            rom: { connect: { id: updated.romId } },
            playState: { connect: { id: updated.id } },
            user: { connect: { id: request.user.sub } },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          { romId: updated.romId, playStateId: updated.id },
        );
      }

      return serializePlayState(updated);
    },
  );

  app.delete(
    "/player/play-states/:id",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const playState = await app.prisma.playState.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true, storageKey: true },
      });

      if (!playState || playState.userId !== request.user.sub) {
        throw app.httpErrors.notFound("Play state not found");
      }

      await removePlayState(app, playState);
      reply.code(204);
    },
  );
}
