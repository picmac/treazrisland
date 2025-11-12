import type { FastifyPluginAsync } from 'fastify';

import { loginController } from './login.controller';
import { magicLinkController } from './magic-link.controller';
import { refreshTokenController } from './refresh-token.controller';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(loginController);
  await fastify.register(magicLinkController);
  await fastify.register(refreshTokenController);
};
