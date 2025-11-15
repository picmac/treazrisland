import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import { createMinioClient, ensureBucket } from './storage';

import type { RomAssetRecord, RomRecord } from './rom.service';
import type { SaveStateRecord } from './save-state.service';
import type { AuthUser } from '../auth/types';
import type { FastifyError, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Readable } from 'node:stream';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  platform: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  favorites: z.enum(['true', 'false']).optional(),
});

const romIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const romIdParamsSchema = z.object({
  id: romIdSchema,
});

const saveStateBodySchema = z.object({
  data: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Save data must be base64-encoded'),
  label: z.string().trim().min(1).max(100).optional(),
  slot: z.coerce.number().int().min(0).max(9).default(0),
  contentType: z.string().min(1).max(255).default('application/octet-stream'),
});

export const MAX_SAVE_STATE_BYTES = 5 * 1024 * 1024; // 5 MiB
const BASE64_OVERHEAD_FACTOR = 4 / 3; // base64 inflates payload size by ~33%
const MAX_SAVE_STATE_BODY_BYTES = Math.ceil(MAX_SAVE_STATE_BYTES * BASE64_OVERHEAD_FACTOR);

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

const serializeRomAsset = (asset: RomAssetRecord) => ({
  id: asset.id,
  type: asset.type,
  checksum: asset.checksum,
  contentType: asset.contentType,
  size: asset.size,
  createdAt: asset.createdAt.toISOString(),
  url: asset.url,
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

  if (
    typeof user === 'object' &&
    'id' in user &&
    typeof (user as { id?: unknown }).id === 'string'
  ) {
    return user.id as string;
  }

  return undefined;
};

const tryAuthenticateRequest = async (request: FastifyRequest): Promise<void> => {
  if (request.user) {
    return;
  }

  const hasAuthHeader =
    typeof request.headers.authorization === 'string' &&
    request.headers.authorization.trim().length > 0;

  if (!hasAuthHeader) {
    return;
  }

  try {
    const payload = await request.jwtVerify<{ sub: string; email?: string }>();
    const user: AuthUser = {
      id: payload.sub,
      email: payload.email ?? payload.sub,
    };

    request.user = user;
  } catch (error) {
    request.log.debug({ err: error }, 'Optional authentication for ROM route failed');
  }
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

    const result = await fastify.romService.list({
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

    await tryAuthenticateRequest(request);

    const rom = await fastify.romService.findById(parsed.data.id);

    if (!rom) {
      return reply.status(404).send({ error: 'ROM not found' });
    }

    const userId = getRequestUserId(request.user);
    const isFavorite = userId ? await fastify.romService.isFavorite(userId, rom.id) : false;

    return reply.send({
      rom: {
        ...serializeRomSummary(rom),
        assets: rom.assets.map((asset) => serializeRomAsset(asset)),
        isFavorite,
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

      const rom = await fastify.romService.findById(parsed.data.id);

      if (!rom) {
        return reply.status(404).send({ error: 'ROM not found' });
      }

      const userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const isFavorite = await fastify.romService.toggleFavorite(userId, rom.id);

      return reply.send({ romId: rom.id, isFavorite });
    },
  );

  fastify.post(
    '/roms/:id/save-state',
    {
      preHandler: fastify.authenticate,
      bodyLimit: MAX_SAVE_STATE_BODY_BYTES,
      errorHandler: (error: FastifyError, request, reply) => {
        if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
          return reply.status(413).send({ error: 'Save state exceeds maximum allowed size' });
        }

        throw error;
      },
    },
    async (request, reply) => {
      const params = romIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid ROM identifier' });
      }

      const rom = await fastify.romService.findById(params.data.id);

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
        return reply.status(413).send({ error: 'Save state exceeds maximum allowed size' });
      }

      const bucket = fastify.config.OBJECT_STORAGE_BUCKET;

      await ensureBucket(minioClient, bucket, fastify.config.OBJECT_STORAGE_REGION);

      const checksum = createHash('sha256').update(saveBuffer).digest('hex');
      const objectKey = `save-states/${userId}/${rom.id}/${Date.now()}-${randomUUID()}.bin`;

      try {
        await minioClient.putObject(bucket, objectKey, saveBuffer, saveBuffer.byteLength, {
          'Content-Type': contentType,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to persist save state object');
        return reply.status(502).send({ error: 'Unable to persist save state' });
      }

      const saveState = fastify.saveStateService.create({
        userId,
        romId: rom.id,
        slot,
        label: label ?? null,
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

      const rom = await fastify.romService.findById(params.data.id);

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
