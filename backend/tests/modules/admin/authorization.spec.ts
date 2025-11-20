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

const DEFAULT_PASSWORD = 'password123';
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

describe('Admin authorization guard', () => {
  let env: Env;
  let app: ReturnType<typeof createApp> | null = null;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;

  const getApp = (): NonNullable<typeof app> => {
    if (!app) {
      throw new Error('Fastify app not initialised');
    }

    return app;
  };

  const createUser = async (email: string, isAdmin: boolean) => {
    if (!database) {
      throw new Error('Test database not initialised');
    }

    const username =
      email
        .split('@')[0]
        ?.replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 32) || 'user';

    return database.prisma.user.create({
      data: {
        email,
        username,
        displayName: username,
        passwordHash: DEFAULT_PASSWORD_HASH,
        isAdmin,
      },
    });
  };

  const getAccessToken = async (email: string): Promise<string> => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: DEFAULT_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string };
    return body.accessToken;
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      process.env.DATABASE_URL = database.connectionString;
      env = parseEnv(process.env);
    } catch (error) {
      databaseError = error as Error;
      console.warn('[admin-guard] Skipping admin guard tests:', databaseError.message);
    }
  });

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError) {
      return;
    }

    await resetDatabase(database?.prisma);
    app = createApp(env, { prisma: database!.prisma });
    await app.ready();
  });

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  });

  it('allows admin users to access protected admin routes', async ({ skip }) => {
    if (databaseError) {
      skip();
    }

    const adminEmail = 'admin@example.com';
    await createUser(adminEmail, true);
    const accessToken = await getAccessToken(adminEmail);

    const response = await getApp().inject({
      method: 'GET',
      url: '/admin/emulator-config',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { config: { embedUrl: string; verifiedAt: string | null } };
    expect(body.config.embedUrl).toBeTypeOf('string');
  });

  it('denies non-admin users', async ({ skip }) => {
    if (databaseError) {
      skip();
    }

    await createUser('admin@example.com', true);
    const nonAdminEmail = 'player@example.com';
    await createUser(nonAdminEmail, false);
    const accessToken = await getAccessToken(nonAdminEmail);

    const response = await getApp().inject({
      method: 'GET',
      url: '/admin/emulator-config',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
  });
});
