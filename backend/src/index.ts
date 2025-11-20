import './config/observability-bootstrap';

import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyRedis from '@fastify/redis';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

import { getEnv, type Env } from './config/env';
import {
  hasMetricsExporter,
  respondWithMetricsSnapshot,
  stopObservability,
} from './config/observability';
import { adminRoutes } from './modules/admin/routes';
import { createAuthMailer } from './modules/auth/mailer';
import { authRoutes } from './modules/auth/routes';
import { RedisSessionStore } from './modules/auth/session-store';
import { PrismaInviteStore } from './modules/invites/invite.store';
import { RomService } from './modules/roms/rom.service';
import { romRoutes } from './modules/roms/routes';
import { SaveStateService } from './modules/roms/save-state.service';
import { createRomStorage, type RomStorage } from './modules/roms/storage';
import { createAvatarStorage, type AvatarStorage } from './modules/users/avatar.storage';
import { userRoutes } from './modules/users/routes';
import { buildLogger, loggerPlugin } from './plugins/logger';

import type { AuthUser } from './modules/auth/types';
import type { FastifyRequest } from 'fastify';

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

type AppPluginOptions = {
  env: Env;
  prisma: PrismaClient;
  romStorage: RomStorage;
  avatarStorage: AvatarStorage;
};

const resolveRateLimitIdentity = (request: FastifyRequest): string | undefined => {
  const user = request.user;
  if (user && typeof user === 'object' && 'id' in user) {
    return (user as AuthUser).id;
  }

  return undefined;
};

const appPlugin = fp(
  async (fastify, { env, prisma, romStorage, avatarStorage }: AppPluginOptions) => {
    fastify.decorate('config', env);
    fastify.decorate('prisma', prisma);

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

    fastify.decorate('romStorage', romStorage);
    fastify.decorate('romService', new RomService(prisma, romStorage));
    fastify.decorate('saveStateService', new SaveStateService(prisma, romStorage));
    fastify.decorate('inviteStore', new PrismaInviteStore(prisma));
    fastify.decorate('avatarStorage', avatarStorage);
    fastify.decorate('authMailer', createAuthMailer(fastify.log));

    await fastify.register(fastifyRateLimit, {
      global: true,
      max: 120,
      timeWindow: '1 minute',
      hook: 'preHandler',
      skipOnError: true,
      keyGenerator: (request: FastifyRequest) =>
        resolveRateLimitIdentity(request) ?? request.ip ?? request.hostname ?? 'global',
    });

    const strictRateLimitBuckets = {
      auth: { max: 15, timeWindow: '1 minute' },
      uploads: { max: 5, timeWindow: '1 minute' },
    } as const;

    const uploadRouteMatchers = [
      /^\/roms\/:id\/save-state/,
      /^\/roms\/:id\/save-states/,
      /^\/admin\/roms$/,
      /^\/admin\/roms\/uploads$/,
      /^\/users\/me\/avatar-upload$/,
    ];

    fastify.addHook('onRoute', (routeOptions) => {
      const url = routeOptions.url ?? '';
      const methods = (
        Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
      ).filter((method): method is string => typeof method === 'string');

      const applyBucket = (bucket: { max: number; timeWindow: string }) => {
        const existingConfig = routeOptions.config ?? {};
        const existingRateLimit =
          (existingConfig as { rateLimit?: Record<string, unknown> }).rateLimit ?? {};

        routeOptions.config = {
          ...existingConfig,
          rateLimit: {
            ...existingRateLimit,
            ...bucket,
          },
        };
      };

      if (url.startsWith('/auth')) {
        applyBucket(strictRateLimitBuckets.auth);
        return;
      }

      const isUploadRoute =
        methods.includes('POST') && uploadRouteMatchers.some((matcher) => matcher.test(url));

      if (isUploadRoute) {
        applyBucket(strictRateLimitBuckets.uploads);
      }
    });

    fastify.addHook('onClose', async () => {
      await fastify.redis.quit();
    });

    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(romRoutes);
    await fastify.register(userRoutes);
    await fastify.register(adminRoutes, { prefix: '/admin' });

    fastify.get('/health', async () => buildHealthResponse(fastify.redis, env));
    fastify.get('/metrics', async (request, reply) => {
      if (!hasMetricsExporter()) {
        return reply.status(503).send({ error: 'Metrics exporter disabled' });
      }

      reply.hijack();
      respondWithMetricsSnapshot(request.raw, reply.raw);
      return;
    });
  },
);

type AppDependencies = {
  prisma?: PrismaClient;
  romStorage?: RomStorage;
  avatarStorage?: AvatarStorage;
};

export const createApp = (
  env: Env = getEnv(),
  dependencies: AppDependencies = {},
): ReturnType<typeof Fastify> => {
  const prisma = dependencies.prisma ?? new PrismaClient();
  const romStorage = dependencies.romStorage ?? createRomStorage(env);
  const avatarStorage = dependencies.avatarStorage ?? createAvatarStorage(env);
  const ownsPrisma = !dependencies.prisma;

  const app = Fastify({
    loggerInstance: buildLogger(env),
  });

  void app.register(appPlugin, { env, prisma, romStorage, avatarStorage });

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
