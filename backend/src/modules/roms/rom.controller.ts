import { z } from 'zod';

import type { RomAssetRecord, RomRecord } from './rom.service';
import type { AuthUser } from '../auth/types';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { SaveStateSummary } from './save-state.service';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  platform: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  favorites: z.enum(['true', 'false']).optional(),
  order: z.enum(['newest', 'recent']).default('newest'),
});

// Accept any non-empty identifier so we can serve legacy UUIDs, cuid/cuid2, and fixture slugs.
const romIdSchema = z.string().min(1);

const romIdParamsSchema = z.object({
  id: romIdSchema,
});

const serializeRomSummary = (rom: RomRecord) => ({
  id: rom.id,
  title: rom.title,
  description: rom.description,
  platformId: rom.platformId,
  releaseYear: rom.releaseYear,
  genres: rom.genres,
  createdAt: rom.createdAt.toISOString(),
  updatedAt: rom.updatedAt.toISOString(),
  isFavorite: rom.isFavorite ?? false,
  lastPlayedAt: rom.lastPlayedAt?.toISOString(),
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

const serializePlatform = (platform?: RomRecord['platform']) => {
  if (!platform) {
    return undefined;
  }

  return {
    id: platform.id,
    name: platform.name,
    slug: platform.slug,
  };
};

const serializeSaveStateSummary = (summary?: SaveStateSummary) => {
  if (!summary) {
    return null;
  }

  return {
    total: summary.total,
    latest: summary.latest
      ? {
          id: summary.latest.id,
          slot: summary.latest.slot,
          label: summary.latest.label,
          size: summary.latest.size,
          contentType: summary.latest.contentType,
          checksum: summary.latest.checksum,
          createdAt: summary.latest.createdAt,
          updatedAt: summary.latest.updatedAt,
        }
      : undefined,
  };
};

export const getRequestUserId = (user: FastifyRequest['user']): string | undefined => {
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
    const payload = await request.jwtVerify<{ sub: string; email?: string; isAdmin?: boolean }>();
    const user: AuthUser = {
      id: payload.sub,
      email: payload.email ?? payload.sub,
      isAdmin: Boolean(payload.isAdmin),
    };

    request.user = user;
  } catch (error) {
    request.log.debug({ err: error }, 'Optional authentication for ROM route failed');
  }
};

export const romController: FastifyPluginAsync = async (fastify) => {
  fastify.get('/roms', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM filters' });
    }

    const favoritesOnly = parsed.data.favorites === 'true';
    await tryAuthenticateRequest(request);
    let userId = getRequestUserId(request.user);

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
      orderBy: parsed.data.order,
      activityForUserId: userId,
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

    const userId = getRequestUserId(request.user);
    const rom = await fastify.romService.findById(parsed.data.id, { userId });

    if (!rom) {
      return reply.status(404).send({ error: 'ROM not found' });
    }

    const saveStateSummary = userId
      ? await fastify.saveStateService.getSummary(userId, rom.id)
      : undefined;

    return reply.send({
      rom: {
        ...serializeRomSummary(rom),
        platform: serializePlatform(rom.platform),
        assets: rom.assets.map((asset) => serializeRomAsset(asset)),
        isFavorite: rom.isFavorite ?? false,
        saveStateSummary: serializeSaveStateSummary(saveStateSummary),
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
};
