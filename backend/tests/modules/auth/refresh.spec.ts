import '../../setup-env';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../../helpers/postgres';

describe('POST /auth/refresh', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let env: Env | null = null;

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      env = parseEnv({ ...process.env, DATABASE_URL: database.connectionString });
    } catch (error) {
      databaseError = error as Error;
      console.warn('[auth-refresh] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError || !database || !env) {
      return;
    }

    await resetDatabase(database.prisma);
    app = createApp(env, { prisma: database.prisma });
    await app.ready();
  });

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  });

  it('rotates refresh tokens and returns a new access token', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;

    const loginResponse = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'password123',
      },
    });

    const initialCookie = loginResponse.cookies.find(
      (cookie: { name: string }) => cookie.name === 'refreshToken',
    );

    expect(initialCookie?.value).toBeDefined();

    const refreshResponse = await activeApp.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `refreshToken=${initialCookie?.value}`,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);

    const body = refreshResponse.json() as { accessToken: string };

    expect(body.accessToken).toBeTypeOf('string');

    const rotatedCookie = refreshResponse.cookies.find(
      (cookie: { name: string }) => cookie.name === 'refreshToken',
    );

    expect(rotatedCookie?.value).toBeDefined();
    expect(rotatedCookie?.value).not.toBe(initialCookie?.value);

    const replayResponse = await activeApp.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `refreshToken=${initialCookie?.value}`,
      },
    });

    expect(replayResponse.statusCode).toBe(401);
  });

  it('rejects requests without a refresh token', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;

    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/refresh',
    });

    expect(response.statusCode).toBe(401);
  });
});
