import type { FastifyPluginAsync } from 'fastify';

import { adminRomController } from './admin.controller';

export const romRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(adminRomController);
};
