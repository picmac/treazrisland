import '../../setup-env';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/index';
import { getEnv } from '../../../src/config/env';

describe('POST /metrics/events', () => {
  const env = getEnv();
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(env);
  });

  afterEach(async () => {
    await app.close();
  });

  it('stores aggregated emulator performance samples in Redis', async () => {
    await app.ready();

    const payload = {
      type: 'emulator-performance',
      romId: 'rom-123',
      romTitle: 'Sample ROM',
      fps: 58.4,
      samples: 320,
      memoryUsedMB: 72.5,
      memoryTotalMB: 128,
      intervalMs: 5000,
      clientTimestamp: new Date().toISOString(),
    };

    const response = await supertest(app.server).post('/metrics/events').send(payload);

    expect(response.status).toBe(202);

    const bucket = Math.floor(Date.now() / 60_000) * 60_000;
    const bucketKey = `metrics:emulator:fps:${bucket}:${payload.romId}`;
    const bucketSnapshot = await app.redis.hgetall(bucketKey);

    expect(bucketSnapshot.romId).toBe(payload.romId);
    expect(bucketSnapshot.romTitle).toBe(payload.romTitle);
    expect(Number(bucketSnapshot.fpsSum)).toBeCloseTo(payload.fps * payload.samples);
    expect(Number(bucketSnapshot.samples)).toBe(payload.samples);
    expect(Number(bucketSnapshot.durationMs)).toBe(payload.intervalMs);
    expect(Number(bucketSnapshot.memoryLatest)).toBeCloseTo(payload.memoryUsedMB);

    const latestKey = `metrics:emulator:latest:${payload.romId}`;
    const latestSample = await app.redis.hgetall(latestKey);

    expect(Number(latestSample.fps)).toBeCloseTo(payload.fps);
    expect(Number(latestSample.samples)).toBe(payload.samples);
    expect(latestSample.memoryTotalMB).toBe(String(payload.memoryTotalMB));
  });

  it('rejects malformed events', async () => {
    await app.ready();

    const response = await supertest(app.server).post('/metrics/events').send({
      type: 'emulator-performance',
      fps: -1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid metrics payload');
  });
});
