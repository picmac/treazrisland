import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AuthUser } from '../auth/types';

const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatarObjectKey: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .refine((data) => Boolean(data.displayName) || data.avatarObjectKey !== undefined, {
    message: 'No profile changes supplied',
  });

const avatarUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(3),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

const isAuthUser = (user: unknown): user is AuthUser =>
  Boolean(user && typeof user === 'object' && 'id' in user);

const getRequestUser = (request: FastifyRequest): AuthUser | null =>
  isAuthUser(request.user) ? request.user : null;

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const serializeUser = async (user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarObjectKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) => {
    const avatarUrl = user.avatarObjectKey
      ? await fastify.avatarStorage.getSignedAvatarUrl(user.avatarObjectKey)
      : null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarObjectKey: user.avatarObjectKey,
      avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  };

  fastify.get('/users/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const authUser = getRequestUser(request);

    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarObjectKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const payload = {
      user: await serializeUser(user),
      isProfileComplete: Boolean(user.displayName && user.displayName.trim().length > 1),
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
    const user = await fastify.prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(updatePayload.displayName ? { displayName: updatePayload.displayName.trim() } : {}),
        ...(updatePayload.avatarObjectKey !== undefined
          ? { avatarObjectKey: updatePayload.avatarObjectKey ?? null }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarObjectKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const payload = {
      user: await serializeUser(user),
      isProfileComplete: Boolean(user.displayName && user.displayName.trim().length > 1),
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
