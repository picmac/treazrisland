import '../../setup-env';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/index';
import { getEnv } from '../../../src/config/env';
import type { PrismaClient } from '@prisma/client';

describe('GET /health', () => {
  let app: ReturnType<typeof createApp>;
  const env = getEnv();

  const healthyPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
  } as unknown as PrismaClient;

  const healthyObjectStorageClient = {
    bucketExists: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    healthyObjectStorageClient.bucketExists.mockResolvedValue(true);
    (healthyPrisma.$queryRaw as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ ok: 1 }]);
    app = createApp(env, {
      prisma: healthyPrisma,
      objectStorageClient: healthyObjectStorageClient,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns dependency statuses for the API', async () => {
    await app.ready();

    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      dependencies: {
        redis: { status: 'up' },
        prisma: { status: 'up' },
        objectStorage: {
          status: 'up',
          bucket: app.config.OBJECT_STORAGE_BUCKET,
          region: app.config.OBJECT_STORAGE_REGION,
        },
      },
    });
  });

  it('reports a degraded status when Redis is unavailable', async () => {
    await app.ready();

    app.redis.ping = vi
      .fn()
      .mockRejectedValue(new Error('Redis offline')) as unknown as typeof app.redis.ping;

    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.redis.status).toBe('down');
  });

  it('reports a degraded status when Prisma is unavailable', async () => {
    await app.ready();

    (healthyPrisma.$queryRaw as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database unreachable'),
    );

    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.prisma.status).toBe('down');
  });

  it('reports a degraded status when object storage is unavailable', async () => {
    await app.ready();

    healthyObjectStorageClient.bucketExists.mockResolvedValue(false);

    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.objectStorage.status).toBe('down');
  });
});
