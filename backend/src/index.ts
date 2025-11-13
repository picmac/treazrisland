import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

import { getEnv, type Env } from './config/env';
import { authRoutes } from './modules/auth/routes';
import { RedisSessionStore } from './modules/auth/session-store';
import type { AuthUser } from './modules/auth/types';
import { romRoutes } from './modules/roms/routes';
import { RomService } from './modules/roms/rom.service';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.PORT = process.env.PORT ?? '3000';

const createRedisClient = (env: Env): Redis => {
  if (env.NODE_ENV === 'test' || !env.REDIS_URL) {
    const client = new RedisMock();
    (client as unknown as { status: string }).status = 'ready';
    return client as unknown as Redis;
  }

  return new Redis(env.REDIS_URL);
};

const appPlugin = fp(async (fastify, { env }: { env: Env }) => {
  fastify.decorate('config', env);

  await fastify.register(fastifyCookie, {
    parseOptions: {
      sameSite: 'lax',
    },
  });

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  });

  fastify.decorate(
    'authenticate',
    async function authenticate(request, reply) {
      const payload = await request.jwtVerify<{ sub: string; email?: string }>();

      const user: AuthUser = {
        id: payload.sub,
        email: payload.email ?? payload.sub,
      };

      request.user = user;
    },
  );

  await fastify.register(fastifyRedis, {
    client: createRedisClient(env),
  });

  fastify.decorate(
    'sessionStore',
    new RedisSessionStore(fastify.redis, {
      refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL,
      magicLinkTokenTtlSeconds: env.MAGIC_LINK_TOKEN_TTL,
    }),
  );

  fastify.decorate('romService', new RomService());

  fastify.addHook('onClose', async () => {
    await fastify.redis.quit();
  });

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(romRoutes);
});

export const createApp = (env: Env = getEnv()): FastifyInstance => {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  app.get('/health', async () => ({ status: 'ok' }));

  void app.register(appPlugin, { env });

  return app;
};

const env = getEnv();

export const app = createApp(env);

export const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  void start();
}
