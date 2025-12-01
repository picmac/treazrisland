import type { FastifyPluginAsync } from 'fastify';

import { saveStateRoutes } from '../../savestates/routes';
import { adminRomController } from './admin.controller';
import { romController } from './rom.controller';

export const romRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(romController);
  await fastify.register(saveStateRoutes);
  await fastify.register(adminRomController, { prefix: '/admin' });
};
