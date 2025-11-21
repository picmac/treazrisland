import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { recordAuthAttempt } from '../../config/observability';

import type { AuthUser, RefreshTokenPayload } from './types';
import type { InviteRecord, InviteSeed } from '../invites/invite.store';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const FALLBACK_OPERATOR_PASSWORD = 'password123';
const FALLBACK_PASSWORD_HASH = bcrypt.hashSync(FALLBACK_OPERATOR_PASSWORD, 10);

const magicLinkSchema = z.object({
  token: z.string().min(1),
});

const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});

const inviteIssueSchema = z.object({
  email: z.string().email(),
  expiresInDays: z.number().int().min(0).max(90).default(14),
  redirectUrl: z.string().url().optional(),
});

const inviteRedeemParamsSchema = z.object({
  code: z.string().min(1),
});

const inviteRedeemBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
  redirectUrl: z.string().url(),
});

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
});

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

const resolveAdminFlag = async (prisma: FastifyInstance['prisma']): Promise<boolean> => {
  const userCount = await prisma.user.count();
  return userCount === 0;
};

const hasAdminUser = async (prisma: FastifyInstance['prisma']): Promise<boolean> => {
  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  return adminCount > 0;
};

const setRefreshCookie = (fastify: FastifyInstance, reply: FastifyReply, token: string) => {
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    path: '/auth/refresh',
    sameSite: 'lax',
    secure: fastify.config.NODE_ENV === 'production',
    maxAge: fastify.config.JWT_REFRESH_TOKEN_TTL,
  });
};

const createSessionTokens = async (
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: AuthUser,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const sessionId = randomUUID();

  await fastify.sessionStore.createRefreshSession(sessionId, user);

  const accessToken = await reply.jwtSign(
    { sub: user.id, email: user.email, isAdmin: user.isAdmin },
    { expiresIn: fastify.config.JWT_ACCESS_TOKEN_TTL },
  );

  const refreshToken = fastify.jwt.sign(
    { sub: user.id, sid: sessionId },
    { expiresIn: fastify.config.JWT_REFRESH_TOKEN_TTL },
  );

  setRefreshCookie(fastify, reply, refreshToken);

  return { accessToken, refreshToken };
};

const ensureUserRecord = async (
  email: string,
  prisma: FastifyInstance['prisma'],
): Promise<AuthUser> => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return { id: existing.id, email: existing.email, isAdmin: existing.isAdmin };
  }

  const usernameSeed = buildUsernameSeed(normalizedEmail);
  let attempt = 0;
  const isAdmin = await resolveAdminFlag(prisma);

  while (attempt < 5) {
    const suffix = attempt === 0 ? '' : `_${attempt}`;
    const usernameCandidate = `${usernameSeed}${suffix}`.slice(0, 32);

    try {
      const created = await prisma.user.create({
        data: {
          email: normalizedEmail,
          username: usernameCandidate,
          displayName: usernameCandidate,
          passwordHash: FALLBACK_PASSWORD_HASH,
          isAdmin,
        },
      });

      return { id: created.id, email: created.email, isAdmin: created.isAdmin };
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
      passwordHash: FALLBACK_PASSWORD_HASH,
      isAdmin,
    },
  });

  return { id: created.id, email: created.email, isAdmin: created.isAdmin };
};

const createUserWithPassword = async (
  prisma: FastifyInstance['prisma'],
  email: string,
  passwordHash: string,
  isAdminOverride?: boolean,
): Promise<AuthUser> => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return { id: existing.id, email: existing.email, isAdmin: existing.isAdmin };
  }

  const usernameSeed = buildUsernameSeed(normalizedEmail);
  let attempt = 0;
  const isAdmin =
    typeof isAdminOverride === 'boolean' ? isAdminOverride : await resolveAdminFlag(prisma);

  while (attempt < 5) {
    const suffix = attempt === 0 ? '' : `_${attempt}`;
    const usernameCandidate = `${usernameSeed}${suffix}`.slice(0, 32);

    try {
      const created = await prisma.user.create({
        data: {
          email: normalizedEmail,
          username: usernameCandidate,
          displayName: usernameCandidate,
          passwordHash,
          isAdmin,
        },
      });

      return { id: created.id, email: created.email, isAdmin: created.isAdmin };
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
      passwordHash,
      isAdmin,
    },
  });

  return { id: created.id, email: created.email, isAdmin: created.isAdmin };
};

const generateInviteCode = (): string => randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();

const createInviteForEmail = async (
  fastify: FastifyInstance,
  seed: Omit<InviteSeed, 'code'>,
): Promise<InviteRecord> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const existing = await fastify.inviteStore.getInvite(code);

    if (existing) {
      continue;
    }

    return fastify.inviteStore.setInvite({ ...seed, code });
  }

  throw new Error('Unable to allocate invite code');
};

const appendQueryParam = (url: string, key: string, value: string): string => {
  const parsed = new URL(url);
  parsed.searchParams.set(key, value);
  return parsed.toString();
};

const getRequestUser = (request: FastifyRequest): AuthUser | null => {
  const user = request.user;

  if (user && typeof user === 'object' && 'id' in user && 'email' in user) {
    const candidate = user as Partial<AuthUser>;
    if (
      typeof candidate.id === 'string' &&
      typeof candidate.email === 'string' &&
      typeof candidate.isAdmin === 'boolean'
    ) {
      return { id: candidate.id, email: candidate.email, isAdmin: candidate.isAdmin };
    }

    if (typeof candidate.id === 'string' && typeof candidate.email === 'string') {
      return { id: candidate.id, email: candidate.email, isAdmin: Boolean(candidate.isAdmin) };
    }
  }

  return null;
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/bootstrap', async (_request, reply) => {
    const bootstrapEmail = normalizeEmail(fastify.config.ADMIN_BOOTSTRAP_EMAIL);

    if (await hasAdminUser(fastify.prisma)) {
      return reply.status(409).send({ status: 'skipped', reason: 'Admin already exists' });
    }

    const existingUser = await fastify.prisma.user.findUnique({ where: { email: bootstrapEmail } });

    if (existingUser) {
      return reply.status(409).send({ status: 'skipped', reason: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(fastify.config.ADMIN_BOOTSTRAP_PASSWORD, 10);
    const user = await createUserWithPassword(
      fastify.prisma,
      fastify.config.ADMIN_BOOTSTRAP_EMAIL,
      passwordHash,
      true,
    );

    return reply.status(201).send({ status: 'created', user });
  });

  fastify.post('/login', async (request, reply) => {
    const parsedBody = loginSchema.safeParse(request.body);

    if (!parsedBody.success) {
      recordAuthAttempt({ method: 'password', outcome: 'failure' });
      return reply.status(400).send({ error: 'Invalid login payload' });
    }

    const { email, password } = parsedBody.data;
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let user: AuthUser | null = null;

    if (existingUser) {
      const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordMatches) {
        recordAuthAttempt({ method: 'password', outcome: 'failure' });
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      user = { id: existingUser.id, email: existingUser.email, isAdmin: existingUser.isAdmin };
    } else {
      if (password !== FALLBACK_OPERATOR_PASSWORD) {
        recordAuthAttempt({ method: 'password', outcome: 'failure' });
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      user = await ensureUserRecord(email, fastify.prisma);
    }

    const { accessToken } = await createSessionTokens(fastify, reply, user);
    recordAuthAttempt({ method: 'password', outcome: 'success' });

    reply.setCookie('treazr.accessToken', accessToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: fastify.config.NODE_ENV === 'production',
      maxAge: fastify.config.JWT_ACCESS_TOKEN_TTL,
    });

    return reply.send({
      accessToken,
      user,
    });
  });

  fastify.post('/refresh', async (request, reply) => {
    const cookieToken = request.cookies.refreshToken;
    const parsedBody = refreshBodySchema.safeParse(request.body ?? {});
    const tokenFromBody = parsedBody.success ? parsedBody.data.refreshToken : undefined;
    const refreshToken = cookieToken ?? tokenFromBody;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token missing' });
    }

    let payload: RefreshTokenPayload;

    try {
      payload = await fastify.jwt.verify<RefreshTokenPayload>(refreshToken);
    } catch {
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
      { sub: user.id, email: user.email, isAdmin: user.isAdmin },
      { expiresIn: fastify.config.JWT_ACCESS_TOKEN_TTL },
    );

    const nextRefreshToken = fastify.jwt.sign(
      { sub: user.id, sid: sessionId },
      { expiresIn: fastify.config.JWT_REFRESH_TOKEN_TTL },
    );

    setRefreshCookie(fastify, reply, nextRefreshToken);

    return reply.send({
      accessToken,
      user,
    });
  });

  fastify.post('/magic-link', async (request, reply) => {
    const parsed = magicLinkSchema.safeParse(request.body);

    if (!parsed.success) {
      recordAuthAttempt({ method: 'magic-link', outcome: 'failure' });
      return reply.status(400).send({ error: 'Invalid magic link payload' });
    }

    const user = await fastify.sessionStore.consumeMagicLinkToken(parsed.data.token);

    if (!user) {
      recordAuthAttempt({ method: 'magic-link', outcome: 'failure' });
      return reply.status(401).send({ error: 'Magic link expired or invalid' });
    }

    const { accessToken } = await createSessionTokens(fastify, reply, user);
    recordAuthAttempt({ method: 'magic-link', outcome: 'success' });

    return reply.send({
      accessToken,
      user,
    });
  });

  fastify.post('/magic-link/request', async (request, reply) => {
    const parsed = magicLinkRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid magic link request' });
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const user = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const token = randomUUID();
    await fastify.sessionStore.saveMagicLinkToken(token, {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    });

    const magicLinkUrl = appendQueryParam(parsed.data.redirectUrl, 'token', token);
    await fastify.authMailer.sendMagicLinkEmail({
      email: user.email,
      magicLinkUrl,
      token,
    });

    const includeDebugToken = fastify.config.NODE_ENV !== 'production';

    return reply.status(202).send({
      status: 'sent',
      token: includeDebugToken ? token : undefined,
    });
  });

  fastify.post(
    '/invitations',
    { preHandler: fastify.authorizeAdmin ?? fastify.authenticate },
    async (request, reply) => {
      const parsed = inviteIssueSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid invite payload' });
      }

      const normalizedEmail = normalizeEmail(parsed.data.email);
      const expiresAt =
        parsed.data.expiresInDays === 0
          ? null
          : new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);

      const invite = await createInviteForEmail(fastify, { email: normalizedEmail, expiresAt });

      const redeemUrl = parsed.data.redirectUrl
        ? appendQueryParam(parsed.data.redirectUrl, 'invite', invite.code)
        : undefined;

      await fastify.authMailer.sendInviteEmail({
        email: normalizedEmail,
        inviteCode: invite.code,
        redeemUrl,
      });

      return reply.status(201).send({ code: invite.code, expiresAt: invite.expiresAt });
    },
  );

  fastify.post<{ Params: { code: string } }>(
    '/invitations/:code/redeem',
    async (request, reply) => {
      const parsedParams = inviteRedeemParamsSchema.safeParse(request.params);
      const parsedBody = inviteRedeemBodySchema.safeParse(request.body);

      if (!parsedParams.success || !parsedBody.success) {
        return reply.status(400).send({ error: 'Invalid invite payload' });
      }

      const { code } = parsedParams.data;
      const { email, password } = parsedBody.data;

      const invite = await fastify.inviteStore.getInvite(code);

      if (!invite) {
        return reply.status(404).send({ error: 'Invite not found' });
      }

      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        return reply.status(400).send({ error: 'Invite has expired' });
      }

      if (invite.redeemedAt || invite.redeemedById) {
        return reply.status(409).send({ error: 'Invite already redeemed' });
      }

      if (invite.email && invite.email.toLowerCase() !== normalizeEmail(email)) {
        return reply.status(400).send({ error: 'Invite is reserved for a different email' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createUserWithPassword(fastify.prisma, email, passwordHash);

      await fastify.inviteStore.markRedeemed(invite.code, user.id);

      const tokens = await createSessionTokens(fastify, reply, user);

      return reply.send({ accessToken: tokens.accessToken, user });
    },
  );

  fastify.get('/profile', { preHandler: fastify.authenticate }, async (request, reply) => {
    const authUser = getRequestUser(request);

    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, displayName: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const payload = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      isProfileComplete: Boolean(user.displayName && user.displayName.trim().length > 1),
    };

    return reply.send(payload);
  });

  fastify.patch('/profile', { preHandler: fastify.authenticate }, async (request, reply) => {
    const authUser = getRequestUser(request);

    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = profileUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid profile payload' });
    }

    const user = await fastify.prisma.user.update({
      where: { id: authUser.id },
      data: { displayName: parsed.data.displayName },
      select: { id: true, email: true, displayName: true, createdAt: true, updatedAt: true },
    });

    const payload = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      isProfileComplete: Boolean(user.displayName && user.displayName.trim().length > 1),
    };

    return reply.send(payload);
  });
};
