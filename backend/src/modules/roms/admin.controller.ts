import { z } from 'zod';

import { recordRomUpload } from '../../config/observability';

import { romAssetTypes, type RomAssetType } from './rom.service';
import { RomStorageError } from './storage';

import type { FastifyPluginAsync } from 'fastify';

const assetSchema = z.object({
  type: z.enum(romAssetTypes as [RomAssetType, ...RomAssetType[]]).default('ROM'),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  data: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Checksum must be a SHA-256 hex string'),
});

const createRomSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(1000).optional(),
  platformId: z.string().min(1),
  releaseYear: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
  genres: z.array(z.string().min(1)).max(10).optional(),
  asset: assetSchema,
});

export const adminRomController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/roms', async (request, reply) => {
    const parsed = createRomSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM payload' });
    }

    const { title, description, platformId, releaseYear, genres, asset } = parsed.data;

    try {
      const rom = await fastify.romService.registerRom({
        title,
        description,
        platformId,
        releaseYear,
        genres,
        asset: {
          type: asset.type,
          filename: asset.filename,
          contentType: asset.contentType,
          data: asset.data,
          checksum: asset.checksum,
        },
      });

      recordRomUpload({ source: 'admin', outcome: 'success' });

      return reply.status(201).send({ rom });
    } catch (error) {
      if (error instanceof RomStorageError) {
        const status = error.statusCode >= 500 ? 502 : 400;
        recordRomUpload({ source: 'admin', outcome: 'failure' });
        return reply.status(status).send({ error: error.message });
      }

      request.log.error({ err: error }, 'Failed to register ROM');
      recordRomUpload({ source: 'admin', outcome: 'failure' });
      return reply.status(500).send({ error: 'Unable to register ROM' });
    }
  });
};
