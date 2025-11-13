import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AuthUser } from './types';
import type { FastifyPluginAsync } from 'fastify';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const createUserFromEmail = (email: string): AuthUser => ({
  id: email,
  email,
});

export const loginController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const parsedBody = loginSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({ error: 'Invalid login payload' });
    }

    const { email, password } = parsedBody.data;

    if (password !== 'password123') {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = createUserFromEmail(email);
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
