import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { RefreshTokenPayload } from './types';

const bodySchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});

export const refreshTokenController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/refresh', async (request, reply) => {
    const cookieToken = request.cookies.refreshToken;
    const parsedBody = bodySchema.safeParse(request.body ?? {});
    const tokenFromBody = parsedBody.success ? parsedBody.data.refreshToken : undefined;
    const refreshToken = cookieToken ?? tokenFromBody;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token missing' });
    }

    let payload: RefreshTokenPayload;

    try {
      payload = await fastify.jwt.verify<RefreshTokenPayload>(refreshToken);
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    const user = await fastify.sessionStore.getRefreshSession(payload.sid);

    if (!user) {
      return reply.status(401).send({ error: 'Refresh session expired' });
    }

    await fastify.sessionStore.deleteRefreshSession(payload.sid);

    const sessionId = randomUUID();

    await fastify.sessionStore.createRefreshSession(sessionId, user);

    const accessToken = await reply.jwtSign(
      { sub: user.id, email: user.email },
      { expiresIn: fastify.config.JWT_ACCESS_TOKEN_TTL },
    );

    const nextRefreshToken = fastify.jwt.sign(
      { sub: user.id, sid: sessionId },
      { expiresIn: fastify.config.JWT_REFRESH_TOKEN_TTL },
    );

    reply.setCookie('refreshToken', nextRefreshToken, {
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
