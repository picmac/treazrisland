import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

export const magicLinkController: FastifyPluginAsync = async (fastify) => {
  const bodySchema = z.object({
    token: z.string().min(1),
  });

  fastify.post('/magic-link', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid magic link payload' });
    }

    const user = await fastify.sessionStore.consumeMagicLinkToken(parsed.data.token);

    if (!user) {
      return reply.status(401).send({ error: 'Magic link expired or invalid' });
    }

    const sessionId = randomUUID();

    await fastify.sessionStore.createRefreshSession(sessionId, user);

    const accessToken = await reply.jwtSign(
      { sub: user.id, email: user.email },
      { expiresIn: fastify.config.JWT_ACCESS_TOKEN_TTL },
    );

    const refreshToken = fastify.jwt.sign(
      { sub: user.id, sid: sessionId },
      { expiresIn: fastify.config.JWT_REFRESH_TOKEN_TTL },
    );

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth/refresh',
      sameSite: 'lax',
      secure: fastify.config.NODE_ENV === 'production',
      maxAge: fastify.config.JWT_REFRESH_TOKEN_TTL,
    });

    return reply.send({
      accessToken,
      user,
    });
  });
};
