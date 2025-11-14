import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import { romAssetTypes, type RomAssetType } from './rom.service';
import { createMinioClient, ensureBucket } from './storage';

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
  const minioClient = createMinioClient(fastify.config);

  fastify.post('/roms', async (request, reply) => {
    const parsed = createRomSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid ROM payload' });
    }

    const { title, description, platformId, releaseYear, genres, asset } = parsed.data;

    let assetBuffer: Buffer;
    try {
      assetBuffer = Buffer.from(asset.data, 'base64');
    } catch {
      return reply.status(400).send({ error: 'Asset data must be a base64-encoded string' });
    }

    if (!assetBuffer.length) {
      return reply.status(400).send({ error: 'Asset data cannot be empty' });
    }

    const checksum = createHash('sha256').update(assetBuffer).digest('hex');

    if (checksum !== asset.checksum.toLowerCase()) {
      return reply.status(400).send({ error: 'Checksum mismatch' });
    }

    await ensureBucket(
      minioClient,
      fastify.config.OBJECT_STORAGE_BUCKET,
      fastify.config.OBJECT_STORAGE_REGION,
    );

    const objectKey = `roms/${randomUUID()}-${asset.filename}`;
    const uploadUrl = await minioClient.presignedPutObject(
      fastify.config.OBJECT_STORAGE_BUCKET,
      objectKey,
      fastify.config.OBJECT_STORAGE_PRESIGNED_TTL,
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': asset.contentType,
        'Content-Length': assetBuffer.byteLength.toString(),
      },
      body: assetBuffer,
    });

    if (!uploadResponse.ok) {
      const failureMessage = await uploadResponse.text();
      request.log.error({ failureMessage }, 'Failed to upload ROM asset to MinIO');
      return reply.status(502).send({ error: 'Unable to upload ROM asset to storage' });
    }

    const rom = fastify.romService.registerRom({
      title,
      description,
      platformId,
      releaseYear,
      genres,
      asset: {
        type: asset.type,
        objectKey,
        uri: `s3://${fastify.config.OBJECT_STORAGE_BUCKET}/${objectKey}`,
        checksum,
        contentType: asset.contentType,
        size: assetBuffer.byteLength,
      },
    });

    return reply.status(201).send({ rom });
  });
};
