import { z } from 'zod';

import type { FastifyPluginAsync } from 'fastify';

const emulatorPerformanceSchema = z.object({
  type: z.literal('emulator-performance'),
  romId: z.string().min(1),
  romTitle: z.string().optional(),
  fps: z.number().nonnegative(),
  samples: z.number().int().positive().optional(),
  memoryUsedMB: z.number().nonnegative().optional(),
  memoryTotalMB: z.number().positive().optional(),
  intervalMs: z.number().int().positive().optional(),
  clientTimestamp: z.string().datetime().optional(),
});

const metricsEventSchema = z.discriminatedUnion('type', [emulatorPerformanceSchema]);

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/metrics/events', async (request, reply) => {
    const parsed = metricsEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid metrics payload' });
    }

    await fastify.metricsRecorder.ingest(parsed.data);

    return reply.status(202).send({ status: 'accepted' });
  });
};
