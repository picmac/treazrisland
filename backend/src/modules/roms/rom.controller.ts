import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { Env } from '../../config/env';
import type { RomAssetRecord, RomRecord } from './rom.service';

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

export const romController: FastifyPluginAsync = async (fastify) => {
  fastify.get('/roms', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM filters' });
    }

    const favoritesOnly = parsed.data.favorites === 'true';

    if (favoritesOnly) {
      await fastify.authenticate(request, reply);

      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }

    const result = fastify.romService.list({
      filters: {
        platformId: parsed.data.platform,
        genre: parsed.data.genre,
        favoriteForUserId: favoritesOnly ? request.user?.id : undefined,
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

      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const isFavorite = fastify.romService.toggleFavorite(request.user.id, rom.id);

      return reply.send({ romId: rom.id, isFavorite });
    },
  );
};
