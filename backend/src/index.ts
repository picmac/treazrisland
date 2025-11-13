import './config/observability-bootstrap';

import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

import { getEnv, type Env } from './config/env';
import { stopObservability } from './config/observability';
import { authRoutes } from './modules/auth/routes';
import { RedisSessionStore } from './modules/auth/session-store';
import { RomService } from './modules/roms/rom.service';
import { romRoutes } from './modules/roms/routes';
import { SaveStateService } from './modules/roms/save-state.service';
import { buildLogger, loggerPlugin } from './plugins/logger';

import type { AuthUser } from './modules/auth/types';

const createRedisClient = (env: Env): Redis => {
  if (env.NODE_ENV === 'test' || !env.REDIS_URL) {
    const client = new RedisMock();
    (client as unknown as { status: string }).status = 'ready';
    return client as unknown as Redis;
  }

  return new Redis(env.REDIS_URL);
};

type DependencyStatus = 'up' | 'down';

type HealthDependencies = {
  redis: { status: DependencyStatus };
  objectStorage: { status: 'configured'; bucket: string; region: string };
};

type HealthResponse = {
  status: 'ok' | 'degraded';
  dependencies: HealthDependencies;
};

const redisStatus = (redis: Redis): DependencyStatus =>
  redis.status === 'ready' ? 'up' : 'down';

const buildHealthResponse = (redis: Redis, env: Env): HealthResponse => {
  const redisState = redisStatus(redis);

  const dependencies: HealthDependencies = {
    redis: { status: redisState },
    objectStorage: {
      status: 'configured',
      bucket: env.OBJECT_STORAGE_BUCKET,
      region: env.OBJECT_STORAGE_REGION,
    },
  };

  return {
    status: redisState === 'up' ? 'ok' : 'degraded',
    dependencies,
  };
};

const appPlugin = fp(async (fastify, { env }: { env: Env }) => {
  fastify.decorate('config', env);

  await fastify.register(loggerPlugin);

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
    async function authenticate(request, _reply) {
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
  fastify.decorate('saveStateService', new SaveStateService());

  fastify.addHook('onClose', async () => {
    await fastify.redis.quit();
  });

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(romRoutes);

  fastify.get('/health', async () => buildHealthResponse(fastify.redis, env));
});

export const createApp = (env: Env = getEnv()): ReturnType<typeof Fastify> => {
  const app = Fastify({
    logger: buildLogger(env),
  });

  void app.register(appPlugin, { env });

  app.addHook('onClose', async () => {
    await stopObservability();
  });

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
