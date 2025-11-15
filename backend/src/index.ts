import './config/observability-bootstrap';

import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

import { getEnv, type Env } from './config/env';
import { stopObservability } from './config/observability';
import { authRoutes } from './modules/auth/routes';
import { RedisSessionStore } from './modules/auth/session-store';
import { defaultInviteSeeds, InMemoryInviteStore } from './modules/invites/invite.store';
import { inviteRoutes } from './modules/invites/routes';
import { RomService } from './modules/roms/rom.service';
import { romRoutes } from './modules/roms/routes';
import { SaveStateService } from './modules/roms/save-state.service';
import { createRomStorage, type RomStorage } from './modules/roms/storage';
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

const redisStatus = (redis: Redis): DependencyStatus => (redis.status === 'ready' ? 'up' : 'down');

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

type AppPluginOptions = { env: Env; prisma: PrismaClient; romStorage: RomStorage };

const appPlugin = fp(async (fastify, { env, prisma, romStorage }: AppPluginOptions) => {
  fastify.decorate('config', env);

  await fastify.register(loggerPlugin);

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyCookie, {
    parseOptions: {
      sameSite: 'lax',
    },
  });

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  fastify.decorate('authenticate', async function authenticate(request, _reply) {
    const payload = await request.jwtVerify<{ sub: string; email?: string }>();

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email ?? payload.sub,
    };

    request.user = user;
  });

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

  fastify.decorate('romService', new RomService(prisma, romStorage));
  fastify.decorate('saveStateService', new SaveStateService());
  fastify.decorate('inviteStore', new InMemoryInviteStore(defaultInviteSeeds));

  fastify.addHook('onClose', async () => {
    await fastify.redis.quit();
  });

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(inviteRoutes, { prefix: '/invites' });
  await fastify.register(romRoutes);

  fastify.get('/health', async () => buildHealthResponse(fastify.redis, env));
});

type AppDependencies = {
  prisma?: PrismaClient;
  romStorage?: RomStorage;
};

export const createApp = (
  env: Env = getEnv(),
  dependencies: AppDependencies = {},
): ReturnType<typeof Fastify> => {
  const prisma = dependencies.prisma ?? new PrismaClient();
  const romStorage = dependencies.romStorage ?? createRomStorage(env);
  const ownsPrisma = !dependencies.prisma;

  const app = Fastify({
    loggerInstance: buildLogger(env),
  });

  void app.register(appPlugin, { env, prisma, romStorage });

  app.addHook('onClose', async () => {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }

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
