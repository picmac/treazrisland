import { z } from 'zod';

import { recordRomUpload } from '../../config/observability';

import { romAssetTypes, type RomAssetType } from './rom.service';
import { RomStorageError } from './storage';

import type { FastifyPluginAsync } from 'fastify';

const assetSchema = z.object({
  type: z.enum(romAssetTypes as [RomAssetType, ...RomAssetType[]]).default('ROM'),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Checksum must be a SHA-256 hex string'),
  objectKey: z.string().min(1),
  size: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024),
});

const createRomSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(1000).optional(),
  platformId: z.string().min(1),
  releaseYear: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
  genres: z.array(z.string().min(1)).max(10).optional(),
  asset: assetSchema,
});

const directUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  data: z.string().min(1, 'Upload payload is required'),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Checksum must be a SHA-256 hex string'),
  size: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024, 'File exceeds 50MB limit'),
});

export const adminRomController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/roms/uploads', { preHandler: fastify.authorizeAdmin }, async (request, reply) => {
    const payload = z
      .object({
        filename: z.string().min(1),
        contentType: z.string().min(1),
        size: z
          .number()
          .int()
          .min(1)
          .max(50 * 1024 * 1024),
        checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Checksum must be a SHA-256 hex string'),
      })
      .safeParse(request.body);

    if (!payload.success) {
      return reply.status(400).send({ error: 'Invalid upload request' });
    }

    try {
      const grant = await fastify.romStorage.createUploadGrant({
        filename: payload.data.filename,
        contentType: payload.data.contentType,
        size: payload.data.size,
        checksum: payload.data.checksum,
      });

      return reply.status(201).send(grant);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to generate ROM upload grant');
      return reply.status(502).send({ error: 'Unable to prepare ROM upload' });
    }
  });

  fastify.post(
    '/roms/uploads/direct',
    { preHandler: fastify.authorizeAdmin },
    async (request, reply) => {
      const parsed = directUploadSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid upload payload' });
      }

      try {
        const uploaded = await fastify.romStorage.uploadAsset({
          filename: parsed.data.filename,
          contentType: parsed.data.contentType,
          data: parsed.data.data,
          checksum: parsed.data.checksum,
        });

        return reply.status(201).send({ objectKey: uploaded.objectKey });
      } catch (error) {
        request.log.error({ err: error }, 'Direct ROM upload failed');
        const status = error instanceof RomStorageError ? error.statusCode : 502;
        return reply.status(status >= 400 && status < 600 ? status : 502).send({
          error: 'Unable to upload ROM asset',
        });
      }
    },
  );

  fastify.post('/roms', { preHandler: fastify.authorizeAdmin }, async (request, reply) => {
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
          checksum: asset.checksum,
          objectKey: asset.objectKey,
          size: asset.size,
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
