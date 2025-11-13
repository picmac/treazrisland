import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Env } from '../../config/env';
import type { RomAssetRecord, RomRecord } from './rom.service';
import type { SaveStateRecord } from './save-state.service';
import { createMinioClient, ensureBucket } from './storage';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  platform: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  favorites: z.enum(['true', 'false']).optional(),
});

const romIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const saveStateBodySchema = z.object({
  data: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Save data must be base64-encoded'),
  label: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  slot: z.coerce.number().int().min(0).max(9).default(0),
  contentType: z.string().min(1).max(255).default('application/octet-stream'),
});

export const MAX_SAVE_STATE_BYTES = 5 * 1024 * 1024; // 5 MiB
const MAX_SAVE_STATE_BODY_BYTES = Math.ceil(MAX_SAVE_STATE_BYTES * 1.4);

const buildAssetUrl = (env: Env, objectKey: string): string => {
  const protocol = env.OBJECT_STORAGE_USE_SSL ? 'https' : 'http';
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${protocol}://${env.OBJECT_STORAGE_ENDPOINT}:${env.OBJECT_STORAGE_PORT}/${env.OBJECT_STORAGE_BUCKET}/${encodedKey}`;
};

const serializeRomSummary = (rom: RomRecord) => ({
  id: rom.id,
  title: rom.title,
  description: rom.description,
  platformId: rom.platformId,
  releaseYear: rom.releaseYear,
  genres: rom.genres,
  createdAt: rom.createdAt.toISOString(),
  updatedAt: rom.updatedAt.toISOString(),
});

const serializeRomAsset = (env: Env, asset: RomAssetRecord) => ({
  id: asset.id,
  type: asset.type,
  checksum: asset.checksum,
  contentType: asset.contentType,
  size: asset.size,
  createdAt: asset.createdAt.toISOString(),
  url: buildAssetUrl(env, asset.objectKey),
});

const serializeSaveState = (saveState: SaveStateRecord) => ({
  id: saveState.id,
  romId: saveState.romId,
  slot: saveState.slot,
  label: saveState.label,
  size: saveState.size,
  contentType: saveState.contentType,
  checksum: saveState.checksum,
  createdAt: saveState.createdAt.toISOString(),
  updatedAt: saveState.updatedAt.toISOString(),
});

const getRequestUserId = (user: FastifyRequest['user']): string | undefined => {
  if (!user) {
    return undefined;
  }

  if (typeof user === 'object' && 'id' in user && typeof (user as { id?: unknown }).id === 'string') {
    return user.id as string;
  }

  return undefined;
};

export const romController: FastifyPluginAsync = async (fastify) => {
  const minioClient = createMinioClient(fastify.config);

  fastify.get('/roms', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM filters' });
    }

    const favoritesOnly = parsed.data.favorites === 'true';
    let userId: string | undefined;

    if (favoritesOnly) {
      await fastify.authenticate(request, reply);

      userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }

    const result = fastify.romService.list({
      filters: {
        platformId: parsed.data.platform,
        genre: parsed.data.genre,
        favoriteForUserId: favoritesOnly ? userId : undefined,
      },
      pagination: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      },
    });

    return reply.send({
      items: result.items.map(serializeRomSummary),
      meta: result.meta,
    });
  });

  fastify.get('/roms/:id', async (request, reply) => {
    const parsed = romIdParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM identifier' });
    }

    const rom = fastify.romService.findById(parsed.data.id);

    if (!rom) {
      return reply.status(404).send({ error: 'ROM not found' });
    }

    return reply.send({
      rom: {
        ...serializeRomSummary(rom),
        assets: rom.assets.map((asset) => serializeRomAsset(fastify.config, asset)),
      },
    });
  });

  fastify.post(
    '/roms/:id/favorite',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = romIdParamsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid ROM identifier' });
      }

      const rom = fastify.romService.findById(parsed.data.id);

      if (!rom) {
        return reply.status(404).send({ error: 'ROM not found' });
      }

      const userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const isFavorite = fastify.romService.toggleFavorite(userId, rom.id);

      return reply.send({ romId: rom.id, isFavorite });
    },
  );

  fastify.post(
    '/roms/:id/save-state',
    { preHandler: fastify.authenticate, bodyLimit: MAX_SAVE_STATE_BODY_BYTES },
    async (request, reply) => {
      const params = romIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid ROM identifier' });
      }

      const rom = fastify.romService.findById(params.data.id);

      if (!rom) {
        return reply.status(404).send({ error: 'ROM not found' });
      }

      const userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsedBody = saveStateBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Invalid save state payload' });
      }

      const { data, label, slot, contentType } = parsedBody.data;

      let saveBuffer: Buffer;
      try {
        saveBuffer = Buffer.from(data, 'base64');
      } catch {
        return reply.status(400).send({ error: 'Save state must be base64-encoded' });
      }

      if (!saveBuffer.length) {
        return reply.status(400).send({ error: 'Save state payload cannot be empty' });
      }

      if (saveBuffer.byteLength > MAX_SAVE_STATE_BYTES) {
        return reply
          .status(413)
          .send({ error: 'Save state exceeds maximum allowed size' });
      }

      const bucket = fastify.config.OBJECT_STORAGE_BUCKET;

      await ensureBucket(minioClient, bucket, fastify.config.OBJECT_STORAGE_REGION);

      const checksum = createHash('sha256').update(saveBuffer).digest('hex');
      const objectKey = `save-states/${userId}/${rom.id}/${Date.now()}-${randomUUID()}.bin`;

      try {
        await minioClient.putObject(
          bucket,
          objectKey,
          saveBuffer,
          saveBuffer.byteLength,
          { 'Content-Type': contentType },
        );
      } catch (error) {
        request.log.error({ err: error }, 'Failed to persist save state object');
        return reply.status(502).send({ error: 'Unable to persist save state' });
      }

      const saveState = fastify.saveStateService.create({
        userId,
        romId: rom.id,
        slot,
        label,
        objectKey,
        checksum,
        size: saveBuffer.byteLength,
        contentType,
      });

      return reply.status(201).send({ saveState: serializeSaveState(saveState) });
    },
  );

  fastify.get(
    '/roms/:id/save-state/latest',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const params = romIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid ROM identifier' });
      }

      const rom = fastify.romService.findById(params.data.id);

      if (!rom) {
        return reply.status(404).send({ error: 'ROM not found' });
      }

      const userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const saveState = fastify.saveStateService.getLatest(userId, rom.id);

      if (!saveState) {
        return reply.status(404).send({ error: 'No save state found' });
      }

      let objectStream: Readable;

      try {
        objectStream = (await minioClient.getObject(
          fastify.config.OBJECT_STORAGE_BUCKET,
          saveState.objectKey,
        )) as Readable;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to retrieve save state object');
        return reply.status(502).send({ error: 'Unable to load save state' });
      }

      const buffer = await streamToBuffer(objectStream);

      return reply.send({
        saveState: serializeSaveState(saveState),
        data: buffer.toString('base64'),
      });
    },
  );
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};
