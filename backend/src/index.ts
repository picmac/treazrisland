import './config/observability-bootstrap';

import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyRedis from '@fastify/redis';
import type { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

import { getEnv, type Env } from './config/env';
import { createPrismaClient, prisma as sharedPrisma } from './config/prisma';
import { createRateLimitHook } from './config/rate-limit';
import {
  hasMetricsExporter,
  respondWithMetricsSnapshot,
  stopObservability,
} from './config/observability';
import { adminRoutes } from './modules/admin/routes';
import { createAuthMailer } from './modules/auth/mailer';
import { authRoutes } from './modules/auth/routes';
import { RedisSessionStore } from './modules/auth/session-store';
import { PrismaSessionService } from './auth/session.service';
import { PrismaInviteStore } from './modules/invites/invite.store';
import { RomService } from './modules/roms/rom.service';
import { romRoutes } from './modules/roms/routes';
import { SaveStateService } from './modules/roms/save-state.service';
import { createMinioClient, createRomStorage, type RomStorage } from './modules/roms/storage';
import { createAvatarStorage, type AvatarStorage } from './modules/users/avatar.storage';
import { userGraphqlRoutes } from './modules/users/graphql';
import { userRoutes } from './modules/users/routes';
import { MetricsRecorder } from './modules/metrics/metrics.recorder';
import { MetricsStore } from './modules/metrics/metrics.store';
import { metricsRoutes } from './modules/metrics/routes';
import { buildLogger, loggerPlugin } from './plugins/logger';

import type { Client as MinioClient } from 'minio';

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

type DependencyHealth = {
  status: DependencyStatus;
  error?: string;
};

type ObjectStorageHealth = DependencyHealth & {
  bucket: string;
  region: string;
};

type HealthDependencies = {
  redis: DependencyHealth;
  prisma: DependencyHealth;
  objectStorage: ObjectStorageHealth;
};

type HealthResponse = {
  status: 'ok' | 'degraded';
  dependencies: HealthDependencies;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const checkRedisHealth = async (redis: Redis): Promise<DependencyHealth> => {
  try {
    if (typeof redis.ping === 'function') {
      await redis.ping();
    }

    return { status: 'up' };
  } catch (error) {
    return { status: 'down', error: toErrorMessage(error) };
  }
};

const checkPrismaHealth = async (prisma: PrismaClient): Promise<DependencyHealth> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', error: toErrorMessage(error) };
  }
};

const checkObjectStorageHealth = async (
  env: Env,
  client: Pick<MinioClient, 'bucketExists'>,
): Promise<ObjectStorageHealth> => {
  try {
    const bucketExists = await client.bucketExists(env.OBJECT_STORAGE_BUCKET);

    return {
      status: bucketExists ? 'up' : 'down',
      bucket: env.OBJECT_STORAGE_BUCKET,
      region: env.OBJECT_STORAGE_REGION,
      error: bucketExists ? undefined : 'Bucket not found',
    };
  } catch (error) {
    return {
      status: 'down',
      bucket: env.OBJECT_STORAGE_BUCKET,
      region: env.OBJECT_STORAGE_REGION,
      error: toErrorMessage(error),
    };
  }
};

const buildHealthResponse = async (
  redis: Redis,
  prisma: PrismaClient,
  env: Env,
  objectStorageClient: Pick<MinioClient, 'bucketExists'> = createMinioClient(env),
): Promise<HealthResponse> => {
  const [redisHealth, prismaHealth, objectStorageHealth] = await Promise.all([
    checkRedisHealth(redis),
    checkPrismaHealth(prisma),
    checkObjectStorageHealth(env, objectStorageClient),
  ]);

  const hasDegradedDependency = [redisHealth, prismaHealth, objectStorageHealth].some(
    (dependency) => dependency.status === 'down',
  );

  return {
    status: hasDegradedDependency ? 'degraded' : 'ok',
    dependencies: {
      redis: redisHealth,
      prisma: prismaHealth,
      objectStorage: objectStorageHealth,
    },
  };
};

type AppPluginOptions = {
  env: Env;
  prisma: PrismaClient;
  romStorage: RomStorage;
  avatarStorage: AvatarStorage;
  objectStorageClient?: Pick<MinioClient, 'bucketExists'>;
};

const resolveRateLimitIdentity = (request: FastifyRequest): string | undefined => {
  const user = request.user;
  if (user && typeof user === 'object' && 'id' in user) {
    return (user as AuthUser).id;
  }

  return undefined;
};

const appPlugin = fp(
  async (
    fastify,
    { env, prisma, romStorage, avatarStorage, objectStorageClient }: AppPluginOptions,
  ) => {
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

    fastify.decorate('authenticate', async function authenticate(request, reply) {
      void reply;
      const payload = await request.jwtVerify<{ sub: string; email?: string; isAdmin?: boolean }>();

      const user: AuthUser = {
        id: payload.sub,
        email: payload.email ?? payload.sub,
        isAdmin: Boolean(payload.isAdmin),
      };

      request.user = user;
    });

    fastify.decorate('authorizeAdmin', async function authorizeAdmin(request, reply) {
      await fastify.authenticate(request, reply);

      const user = request.user as AuthUser | undefined;

      if (!user?.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
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

    fastify.decorate(
      'sessionService',
      new PrismaSessionService(prisma, { refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL }),
    );

    const metricsStore = new MetricsStore(fastify.redis);
    fastify.decorate('metricsRecorder', new MetricsRecorder(metricsStore));

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

    fastify.addHook('onRoute', createRateLimitHook());

    fastify.addHook('onClose', async () => {
      await fastify.redis.quit();
    });

    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(romRoutes);
    await fastify.register(userGraphqlRoutes);
    await fastify.register(userRoutes);
    await fastify.register(adminRoutes, { prefix: '/admin' });
    await fastify.register(metricsRoutes);

    fastify.get('/health', async () =>
      buildHealthResponse(fastify.redis, prisma, env, objectStorageClient),
    );
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
  objectStorageClient?: Pick<MinioClient, 'bucketExists'>;
};

export const createApp = (
  env: Env = getEnv(),
  dependencies: AppDependencies = {},
): ReturnType<typeof Fastify> => {
  const prisma = dependencies.prisma ?? sharedPrisma ?? createPrismaClient();
  const romStorage = dependencies.romStorage ?? createRomStorage(env);
  const avatarStorage = dependencies.avatarStorage ?? createAvatarStorage(env);
  const ownsPrisma = !dependencies.prisma;

  const app = Fastify({
    loggerInstance: buildLogger(env),
  });

  void app.register(appPlugin, {
    env,
    prisma,
    romStorage,
    avatarStorage,
    objectStorageClient: dependencies.objectStorageClient,
  });

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
