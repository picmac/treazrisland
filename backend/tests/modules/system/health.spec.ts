import '../../setup-env';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/index';

describe('GET /health', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
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
        objectStorage: {
          status: 'configured',
          bucket: app.config.OBJECT_STORAGE_BUCKET,
          region: app.config.OBJECT_STORAGE_REGION,
        },
      },
    });
  });

  it('reports a degraded status when Redis is unavailable', async () => {
    await app.ready();

    (app.redis as { status?: string }).status = 'end';

    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.redis.status).toBe('down');
  });
});
