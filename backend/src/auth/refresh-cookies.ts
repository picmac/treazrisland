import type { FastifyReply } from 'fastify';

import type { Env } from '../config/env';

const COOKIE_NAME = 'refreshToken';

export const setRefreshTokenCookie = (reply: FastifyReply, env: Env, token: string): void => {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: env.JWT_REFRESH_TOKEN_TTL,
  });
};

export const clearRefreshTokenCookie = (reply: FastifyReply, env: Env): void => {
  reply.clearCookie(COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  });
};
