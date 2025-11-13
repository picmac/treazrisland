
import { adminRomController } from './admin.controller';
import { romController } from './rom.controller';

import type { FastifyPluginAsync } from 'fastify';

export const romRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(romController);
  await fastify.register(adminRomController, { prefix: '/admin' });
};
