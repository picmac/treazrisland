import './setup-env';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../src/config/env';
import { createApp } from '../src/index';
import { ensureUserWithPassword } from './helpers/auth';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from './helpers/postgres';
import { TestAvatarStorage } from './helpers/test-avatar-storage';

const TEST_EMAIL = 'pixellab.player@example.com';
const TEST_PASSWORD = 'password123!';

describe('user profile experience', () => {
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let env: Env | null = null;
  let app: ReturnType<typeof createApp> | null = null;
  let avatarStorage: TestAvatarStorage | null = null;

  const startApp = async () => {
    if (!database || !env || !avatarStorage) {
      return;
    }

    if (app) {
      await app.close();
    }

    app = createApp(env, { prisma: database.prisma, avatarStorage });
    await app.ready();
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      env = parseEnv({
        ...process.env,
        DATABASE_URL: database.connectionString,
        SHADOW_DATABASE_URL: database.connectionString,
      });
    } catch (error) {
      databaseError = error as Error;
      console.warn('[users-spec] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async ({ skip }) => {
    if (databaseError || !database || !env) {
      skip();
      return;
    }

    await resetDatabase(database.prisma);
    avatarStorage = new TestAvatarStorage();
    await startApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('updates profile metadata over REST', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    const user = await ensureUserWithPassword(database.prisma, TEST_EMAIL, {
      password: TEST_PASSWORD,
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    expect(loginResponse.statusCode).toBe(200);
    const accessToken = (loginResponse.json() as { accessToken: string }).accessToken;

    const uploadGrantResponse = await app.inject({
      method: 'POST',
      url: '/users/me/avatar-upload',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { filename: 'profile.png', contentType: 'image/png', size: 1024 },
    });

    expect(uploadGrantResponse.statusCode).toBe(200);
    expect(avatarStorage?.requests[0]).toMatchObject({
      userId: user.id,
      filename: 'profile.png',
      contentType: 'image/png',
      size: 1024,
    });

    const grant = uploadGrantResponse.json() as { objectKey: string };

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        displayName: 'Pixel Hero',
        avatarObjectKey: grant.objectKey,
        avatarContentType: 'image/png',
        avatarSize: 1024,
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const payload = patchResponse.json() as {
      user: {
        displayName: string | null;
        avatarContentType: string | null;
        avatarSize: number | null;
        avatarUploadedAt: string | null;
        profileUpdatedAt: string | null;
        profileCompletedAt: string | null;
      };
      isProfileComplete: boolean;
    };

    expect(payload.isProfileComplete).toBe(true);
    expect(payload.user.displayName).toBe('Pixel Hero');
    expect(payload.user.avatarContentType).toBe('image/png');
    expect(payload.user.avatarSize).toBe(1024);
    expect(payload.user.avatarUploadedAt).toMatch(/Z$/);
    expect(payload.user.profileUpdatedAt).toMatch(/Z$/);
    expect(payload.user.profileCompletedAt).toMatch(/Z$/);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(meResponse.statusCode).toBe(200);
    const mePayload = meResponse.json() as {
      user: { avatarUrl: string | null; avatarObjectKey: string };
    };
    expect(mePayload.user.avatarObjectKey).toBe(grant.objectKey);
    expect(mePayload.user.avatarUrl).toContain(grant.objectKey);
  });

  it('supports profile mutations via GraphQL', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    await ensureUserWithPassword(database.prisma, TEST_EMAIL, { password: TEST_PASSWORD });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    expect(loginResponse.statusCode).toBe(200);
    const accessToken = (loginResponse.json() as { accessToken: string }).accessToken;

    const mutation = `
      mutation UpdateProfile($input: ProfileInput!, $upload: AvatarUploadInput!) {
        createAvatarUploadGrant(input: $upload) { objectKey }
        updateProfile(input: $input) {
          isProfileComplete
          user { displayName avatarObjectKey avatarContentType avatarSize avatarUploadedAt }
        }
      }
    `;

    const response = await app.inject({
      method: 'POST',
      url: '/users/graphql',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        query: mutation,
        variables: {
          upload: { filename: 'avatar.png', contentType: 'image/png', size: 2048 },
          input: {
            displayName: 'GraphQL Player',
            avatarObjectKey: 'avatars/graphql/player.png',
            avatarContentType: 'image/png',
            avatarSize: 2048,
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data?: {
        createAvatarUploadGrant: { objectKey: string };
        updateProfile: {
          isProfileComplete: boolean;
          user: { displayName: string; avatarUploadedAt: string | null };
        };
      };
      errors?: unknown[];
    };

    expect(body.errors).toBeUndefined();
    expect(body.data?.createAvatarUploadGrant.objectKey).toContain('avatar.png');
    expect(body.data?.updateProfile.user.displayName).toBe('GraphQL Player');
    expect(body.data?.updateProfile.user.avatarUploadedAt).toMatch(/Z$/);
    expect(body.data?.updateProfile.isProfileComplete).toBe(true);
  });
});
