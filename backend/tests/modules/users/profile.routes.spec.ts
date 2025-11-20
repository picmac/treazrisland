import '../../setup-env';

import { randomUUID } from 'node:crypto';

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
import { TestAvatarStorage } from '../../helpers/test-avatar-storage';

type App = ReturnType<typeof createApp>;

describe('User profile routes', () => {
  let env: Env;
  let app: App;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let avatarStorage: TestAvatarStorage;

  const createUser = async () => {
    if (!database) {
      throw new Error('Database not initialized');
    }

    const email = `player-${randomUUID()}@example.com`;
    const username = `player_${randomUUID().slice(0, 8)}`;
    const passwordHash = bcrypt.hashSync('password123', 10);

    return database.prisma.user.create({
      data: { email, username, passwordHash, displayName: 'Player One' },
    });
  };

  const authHeadersForUser = (user: { id: string; email: string }) => {
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    return { authorization: `Bearer ${accessToken}` };
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      process.env.DATABASE_URL = database.connectionString;
      env = parseEnv(process.env);
    } catch (error) {
      databaseError = error as Error;
      console.warn('[users] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError || !database) {
      return;
    }

    avatarStorage = new TestAvatarStorage();
    await resetDatabase(database.prisma);
    app = createApp(env, { prisma: database.prisma, avatarStorage });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns the signed avatar url when a profile exists', async ({ skip }) => {
    if (databaseError || !database) {
      skip();
      return;
    }

    const user = await createUser();
    await database.prisma.user.update({
      where: { id: user.id },
      data: { avatarObjectKey: 'avatars/test/avatar.png' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: authHeadersForUser(user),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      user: { avatarUrl: string | null; avatarObjectKey: string | null };
    };

    expect(body.user.avatarObjectKey).toBe('avatars/test/avatar.png');
    expect(body.user.avatarUrl).toBe('https://avatar-url/avatars/test/avatar.png');
  });

  it('updates display name and avatar object key', async ({ skip }) => {
    if (databaseError || !database) {
      skip();
      return;
    }

    const user = await createUser();
    const response = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: authHeadersForUser(user),
      payload: { displayName: 'Captain Pixel', avatarObjectKey: 'avatars/new/key.png' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      user: { displayName: string; avatarObjectKey: string | null };
    };

    expect(body.user.displayName).toBe('Captain Pixel');
    expect(body.user.avatarObjectKey).toBe('avatars/new/key.png');

    const stored = await database.prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, avatarObjectKey: true },
    });

    expect(stored?.displayName).toBe('Captain Pixel');
    expect(stored?.avatarObjectKey).toBe('avatars/new/key.png');
  });

  it('issues a signed upload url for avatar uploads', async ({ skip }) => {
    if (databaseError || !database) {
      skip();
      return;
    }

    const user = await createUser();
    const response = await app.inject({
      method: 'POST',
      url: '/users/me/avatar-upload',
      headers: authHeadersForUser(user),
      payload: { filename: 'portrait.png', contentType: 'image/png', size: 1024 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      objectKey: string;
      uploadUrl: string;
      headers: Record<string, string>;
    };

    expect(body.objectKey).toContain(user.id);
    expect(body.uploadUrl).toContain(body.objectKey);
    expect(body.headers['Content-Type']).toBe('image/png');
    expect(avatarStorage.requests[0]).toMatchObject({
      filename: 'portrait.png',
      contentType: 'image/png',
    });
  });
});
