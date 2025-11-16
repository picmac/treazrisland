import '../../setup-env';

import bcrypt from 'bcryptjs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../../helpers/postgres';

describe('POST /auth/login', () => {
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
      console.warn('[auth-login] Skipping Postgres integration tests:', databaseError.message);
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

  it('returns access and refresh tokens for valid credentials', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;

    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { accessToken: string; user: { email: string } };

    expect(body.accessToken).toBeTypeOf('string');
    expect(body.user.email).toBe('player@example.com');
    expect(
      response.cookies.some((cookie: { name: string }) => cookie.name === 'refreshToken'),
    ).toBe(true);
  });

  it('authenticates users created via invite redemption', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    const activeApp = app;
    const password = 'InvitePass123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const email = 'redeemed@example.com';

    await database.prisma.user.create({
      data: {
        email,
        username: 'redeemed_user',
        displayName: 'Redeemed User',
        passwordHash,
      },
    });

    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  it('rejects invalid credentials', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;

    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'wrong-password',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('validates the login payload', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;

    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'not-an-email',
        password: 'short',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
