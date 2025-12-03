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

describe('POST /auth/logout', () => {
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
      console.warn('[auth-logout] Skipping Postgres integration tests:', databaseError.message);
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

  it('revokes the refresh session and clears cookies', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    const activeApp = app;
    const activeDatabase = database;
    const password = 'ValidPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await activeDatabase.prisma.user.create({
      data: {
        email: 'player@example.com',
        username: 'player_one',
        displayName: 'Player One',
        passwordHash,
      },
    });

    const loginResponse = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'player@example.com', password },
    });

    const refreshCookie = loginResponse.cookies.find(
      (cookie: { name: string }) => cookie.name === 'refreshToken',
    );
    expect(refreshCookie?.value).toBeTypeOf('string');

    const sessionBefore = await activeDatabase.prisma.session.findFirst({
      where: { userId: user.id },
    });
    expect(sessionBefore?.status).toBe('ACTIVE');

    const logoutResponse = await activeApp.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: refreshCookie ? { refreshToken: refreshCookie.value } : undefined,
    });

    expect(logoutResponse.statusCode).toBe(204);

    const clearedRefresh = logoutResponse.cookies.find(
      (cookie: { name: string }) => cookie.name === 'refreshToken',
    );
    expect(clearedRefresh?.value).toBe('');

    const clearedAccess = logoutResponse.cookies.find(
      (cookie: { name: string }) => cookie.name === 'treazr.accessToken',
    );
    expect(clearedAccess?.value).toBe('');

    const sessionAfter = await activeDatabase.prisma.session.findFirst({
      where: { id: sessionBefore?.id },
    });
    expect(sessionAfter?.status).toBe('REVOKED');
  });
});
