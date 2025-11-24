import { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { AuthUser } from '../auth/types';
import {
  isProfileComplete,
  serializeUserProfile,
  userProfileSelect,
  updateUserProfile,
} from './profile';
import { avatarUploadSchema, profilePatchSchema } from './validators';

const getRequestUser = (request: FastifyRequest): AuthUser | null => {
  const user = request.user as Partial<AuthUser> | undefined;

  if (user && typeof user.id === 'string' && typeof user.email === 'string') {
    return { id: user.id, email: user.email, isAdmin: Boolean(user.isAdmin) };
  }

  return null;
};

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const authUser = getRequestUser(request);

    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: authUser.id },
      select: userProfileSelect,
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const payload = {
      user: await serializeUserProfile(user, fastify.avatarStorage),
      isProfileComplete: isProfileComplete(user),
    };

    return reply.send(payload);
  });

  fastify.patch('/users/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const authUser = getRequestUser(request);

    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = profilePatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid profile payload' });
    }

    const updatePayload = parsed.data;
    const result = await updateUserProfile(
      fastify.prisma,
      fastify.avatarStorage,
      authUser.id,
      updatePayload,
    );

    if (!result) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const payload = {
      user: result.user,
      isProfileComplete: result.isProfileComplete,
    };

    return reply.send(payload);
  });

  fastify.post(
    '/users/me/avatar-upload',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const authUser = getRequestUser(request);

      if (!authUser) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = avatarUploadSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid upload payload' });
      }

      const grant = await fastify.avatarStorage.createUploadGrant({
        userId: authUser.id,
        filename: parsed.data.filename,
        contentType: parsed.data.contentType,
        size: parsed.data.size,
      });

      return reply.send(grant);
    },
  );
};
