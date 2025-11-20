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

const issueInvite = async (
  app: NonNullable<ReturnType<typeof createApp>>,
  token: string | null,
  payload?: Record<string, unknown>,
) =>
  app.inject({
    method: 'POST',
    url: '/auth/invitations',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: {
      email: 'invitee@example.com',
      expiresInDays: 7,
      ...(payload ?? {}),
    },
  });

describe('POST /auth/invitations', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let env: Env | null = null;

  const loginWith = async (
    activeApp: NonNullable<ReturnType<typeof createApp>>,
    email: string,
  ): Promise<string> => {
    const response = await activeApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string };
    return body.accessToken;
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      env = parseEnv({ ...process.env, DATABASE_URL: database.connectionString });
    } catch (error) {
      databaseError = error as Error;
      console.warn(
        '[auth-invitations] Skipping Postgres integration tests:',
        databaseError.message,
      );
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

  it('allows admins to create invitations', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const adminToken = await loginWith(activeApp, 'admin@example.com');

    const response = await issueInvite(activeApp, adminToken, { email: 'new-invitee@example.com' });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { code: string };
    expect(body.code).toBeTypeOf('string');

    const storedInvite = await activeApp.inviteStore.getInvite(body.code);
    expect(storedInvite?.email).toBe('new-invitee@example.com');
  });

  it('rejects unauthenticated requests', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const response = await issueInvite(activeApp, null);

    expect(response.statusCode).toBe(401);
  });

  it('rejects non-admin users', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    await loginWith(activeApp, 'admin@example.com');
    const userToken = await loginWith(activeApp, 'player@example.com');

    const response = await issueInvite(activeApp, userToken);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
  });
});
