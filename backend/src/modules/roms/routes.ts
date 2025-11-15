import { z } from 'zod';

import { adminRomController } from './admin.controller';
import { getRequestUserId, romController } from './rom.controller';

import type { SaveStateRecord } from './save-state.service';
import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

const romIdSchema = z.union([z.string().uuid(), z.string().cuid()]);
const saveStateIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const saveStateParamsSchema = z.object({
  id: romIdSchema,
});

const saveStateDetailParamsSchema = z.object({
  id: romIdSchema,
  saveStateId: saveStateIdSchema,
});

const saveStateBodySchema = z.object({
  data: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Save data must be base64-encoded'),
  label: z.string().trim().min(1).max(100).optional(),
  slot: z.coerce.number().int().min(0).max(9).default(0),
  contentType: z.string().min(1).max(255).default('application/octet-stream'),
  filename: z.string().trim().min(1).max(255).optional(),
});

export const MAX_SAVE_STATE_BYTES = 5 * 1024 * 1024; // 5 MiB
const BASE64_OVERHEAD_FACTOR = 4 / 3;
const MAX_SAVE_STATE_BODY_BYTES = Math.ceil(MAX_SAVE_STATE_BYTES * BASE64_OVERHEAD_FACTOR);

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

const saveStateRoutes: FastifyPluginAsync = async (fastify) => {
  const saveStateUploadHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = saveStateParamsSchema.safeParse(request.params);

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

    const { data, label, slot, contentType, filename } = parsedBody.data;

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

    try {
      const saveState = await fastify.saveStateService.create({
        userId,
        romId: rom.id,
        slot,
        label: label ?? null,
        binary: {
          filename: filename ?? `save-state-slot-${slot}.bin`,
          contentType,
          data: saveBuffer,
        },
      });

      return reply.status(201).send({ saveState: serializeSaveState(saveState) });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to persist save state');
      return reply.status(502).send({ error: 'Unable to persist save state' });
    }
  };

  const saveStateUploadOptions = {
    preHandler: fastify.authenticate,
    bodyLimit: MAX_SAVE_STATE_BODY_BYTES,
    errorHandler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        return reply.status(413).send({ error: 'Save state exceeds maximum allowed size' });
      }

      throw error;
    },
  };

  fastify.post('/roms/:id/save-states', saveStateUploadOptions, saveStateUploadHandler);
  fastify.post('/roms/:id/save-state', saveStateUploadOptions, saveStateUploadHandler);

  fastify.get(
    '/roms/:id/save-states/:saveStateId',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const params = saveStateDetailParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid save state identifier' });
      }

      const rom = await fastify.romService.findById(params.data.id);

      if (!rom) {
        return reply.status(404).send({ error: 'ROM not found' });
      }

      const userId = getRequestUserId(request.user);

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const result = await fastify.saveStateService.getById(
          userId,
          rom.id,
          params.data.saveStateId,
          {
            includeData: true,
          },
        );

        if (!result) {
          return reply.status(404).send({ error: 'Save state not found' });
        }

        if (!result.data) {
          return reply.status(404).send({ error: 'Save state data missing' });
        }

        return reply.send({
          saveState: serializeSaveState(result.saveState),
          data: result.data.toString('base64'),
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to load save state');
        return reply.status(502).send({ error: 'Unable to load save state' });
      }
    },
  );

  const latestRouteHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = saveStateParamsSchema.safeParse(request.params);

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

    try {
      const result = await fastify.saveStateService.getLatest(userId, rom.id, {
        includeData: true,
      });

      if (!result) {
        return reply.status(404).send({ error: 'Save state not found' });
      }

      if (!result.data) {
        return reply.status(404).send({ error: 'Save state data missing' });
      }

      return reply.send({
        saveState: serializeSaveState(result.saveState),
        data: result.data.toString('base64'),
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to load save state');
      return reply.status(502).send({ error: 'Unable to load save state' });
    }
  };

  ['/roms/:id/save-state/latest', '/roms/:id/save-states/latest'].forEach((path) => {
    fastify.get(path, { preHandler: fastify.authenticate }, latestRouteHandler);
  });
};

export const romRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(romController);
  await fastify.register(saveStateRoutes);
  await fastify.register(adminRomController, { prefix: '/admin' });
};
