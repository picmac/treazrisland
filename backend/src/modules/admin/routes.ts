import type { FastifyPluginAsync } from 'fastify';

import { adminInvitationsController } from './invitations.controller';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(adminInvitationsController);
};
