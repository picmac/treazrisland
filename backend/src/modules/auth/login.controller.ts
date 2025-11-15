import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const DEV_PASSWORD_HASH = 'dev-placeholder-password-hash';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const buildUsernameSeed = (email: string): string => {
  const [localPart] = email.split('@');
  const sanitized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized.length > 0 ? sanitized.slice(0, 24) : 'player';
};

const ensureUserRecord = async (
  email: string,
  prisma: FastifyInstance['prisma'],
): Promise<{ id: string; email: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return { id: existing.id, email: existing.email };
  }

  const usernameSeed = buildUsernameSeed(normalizedEmail);
  let attempt = 0;

  while (attempt < 5) {
    const suffix = attempt === 0 ? '' : `_${attempt}`;
    const usernameCandidate = `${usernameSeed}${suffix}`.slice(0, 32);

    try {
      const created = await prisma.user.create({
        data: {
          email: normalizedEmail,
          username: usernameCandidate,
          displayName: usernameCandidate,
          passwordHash: DEV_PASSWORD_HASH,
        },
      });

      return { id: created.id, email: created.email };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.target &&
        String(error.meta.target).includes('username')
      ) {
        attempt += 1;
        continue;
      }

      throw error;
    }
  }

  const fallbackUsername = `player_${randomUUID().slice(0, 8)}`;
  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: fallbackUsername,
      displayName: fallbackUsername,
      passwordHash: DEV_PASSWORD_HASH,
    },
  });

  return { id: created.id, email: created.email };
};

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

    const user = await ensureUserRecord(email, fastify.prisma);
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

    reply.setCookie('treazr.accessToken', accessToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: fastify.config.NODE_ENV === 'production',
      maxAge: fastify.config.JWT_ACCESS_TOKEN_TTL,
    });

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
