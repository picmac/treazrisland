import { z } from 'zod';

import type { FastifyPluginAsync } from 'fastify';

const emulatorConfigSchema = z.object({
  embedUrl: z.string().url(),
});

const EMULATOR_CONFIG_REDIS_KEY = 'admin:emulator-config';
const DEFAULT_EMULATOR_EMBED_URL =
  process.env.NEXT_PUBLIC_EMULATOR_EMBED_URL ?? 'http://localhost:8080/dist/embed.js';
const EMULATOR_REQUEST_TIMEOUT_MS = 5000;

const verifyEmulatorEndpoint = async (embedUrl: string): Promise<void> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMULATOR_REQUEST_TIMEOUT_MS);

  try {
    let response = await fetch(embedUrl, { method: 'HEAD', signal: controller.signal });

    if (response.status === 405) {
      response = await fetch(embedUrl, { method: 'GET', signal: controller.signal });
    }

    if (!response.ok) {
      throw new Error(`Emulator endpoint responded with ${response.status}`);
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Connection to EmulatorJS endpoint timed out'
        : 'Unable to reach EmulatorJS endpoint';
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
};

const parseStoredConfig = (raw: string | null) => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { embedUrl: string; verifiedAt: string };

    if (typeof parsed.embedUrl === 'string' && typeof parsed.verifiedAt === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticatedRoute = { preHandler: fastify.authenticate } as const;

  fastify.get('/emulator-config', authenticatedRoute, async (_request, reply) => {
    const stored = parseStoredConfig(await fastify.redis.get(EMULATOR_CONFIG_REDIS_KEY));

    const config = stored ?? {
      embedUrl: DEFAULT_EMULATOR_EMBED_URL,
      verifiedAt: null,
    };

    return reply.send({ config });
  });

  fastify.put('/emulator-config', authenticatedRoute, async (request, reply) => {
    const parsed = emulatorConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid EmulatorJS configuration payload' });
    }

    try {
      await verifyEmulatorEndpoint(parsed.data.embedUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to verify EmulatorJS endpoint';
      return reply.status(400).send({ error: message });
    }

    const config = {
      embedUrl: parsed.data.embedUrl,
      verifiedAt: new Date().toISOString(),
    };

    await fastify.redis.set(EMULATOR_CONFIG_REDIS_KEY, JSON.stringify(config));

    return reply.send({ config });
  });
};
