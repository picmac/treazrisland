import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { z } from 'zod';

import type { AuthUser } from '../auth/types';
import type { FastifyPluginAsync } from 'fastify';

const redeemParamsSchema = z.object({
  code: z.string().min(1),
});

const redeemBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const inviteRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/:code/redeem', async (request, reply) => {
    const parsedParams = redeemParamsSchema.safeParse(request.params);
    const parsedBody = redeemBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({ error: 'Invalid invite payload' });
    }

    const { code } = parsedParams.data;
    const { email, password } = parsedBody.data;

    const invite = fastify.inviteStore.getInvite(code);

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found' });
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return reply.status(400).send({ error: 'Invite has expired' });
    }

    if (invite.redeemedAt || invite.redeemedById) {
      return reply.status(409).send({ error: 'Invite already redeemed' });
    }

    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return reply.status(400).send({ error: 'Invite is reserved for a different email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const storedUser = fastify.inviteStore.createUser(email, passwordHash);

    fastify.inviteStore.markRedeemed(invite.code, storedUser.id);

    const user: AuthUser = { id: storedUser.id, email: storedUser.email };
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

    return reply.send({ accessToken, user });
  });
};
