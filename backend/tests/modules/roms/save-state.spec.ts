import '../../setup-env';

import { createHash, randomUUID } from 'node:crypto';

import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';
import { MAX_SAVE_STATE_BYTES } from '../../../src/modules/roms/routes';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../../helpers/postgres';

describe('ROM save state endpoints', () => {
  const bucket = 'rom-save-state-tests';
  let container: StartedTestContainer | null = null;
  let env: Env;
  let app: ReturnType<typeof createApp> | null = null;
  let runtimeError: Error | null = null;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;

  const getApp = (): NonNullable<typeof app> => {
    if (!app) {
      throw new Error('Fastify app not initialised');
    }

    return app;
  };

  const createRom = async (): Promise<string> => {
    const romPayload = Buffer.from('test-rom');
    const checksum = createHash('sha256').update(romPayload).digest('hex');

    const response = await getApp().inject({
      method: 'POST',
      url: '/admin/roms',
      payload: {
        title: 'Save State Test',
        platformId: 'nes',
        releaseYear: 1993,
        asset: {
          filename: 'save-test.zip',
          contentType: 'application/zip',
          data: romPayload.toString('base64'),
          checksum,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { rom: { id: string } };
    return body.rom.id;
  };

  type TestCookie = { name: string; value: string };

  const login = async (email = 'player@example.com') => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string };
    const refreshCookie = response.cookies.find(
      (cookie: TestCookie) => cookie.name === 'refreshToken',
    );

    return { body, refreshCookie };
  };

  const getAccessToken = async (email = 'player@example.com'): Promise<string> => {
    const { body } = await login(email);
    return body.accessToken;
  };

  const getRefreshCookie = async (): Promise<string> => {
    const { refreshCookie } = await login();

    expect(refreshCookie).toBeDefined();
    return `${refreshCookie!.name}=${refreshCookie!.value}`;
  };

  const registerRomRecord = async (): Promise<string> => createRom();

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      process.env.DATABASE_URL = database.connectionString;
    } catch (error) {
      databaseError = error as Error;
      console.warn('[save-state] Skipping Postgres integration tests:', databaseError.message);
      return;
    }

    container = await new GenericContainer('quay.io/minio/minio')
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin',
      })
      .withExposedPorts(9000)
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .start()
      .catch((error: Error) => {
        runtimeError = error;
        return undefined as unknown as StartedTestContainer;
      });

    env = parseEnv(process.env);

    if (runtimeError || !container) {
      console.warn('[save-state] Skipping MinIO integration tests:', runtimeError?.message);
      return;
    }

    const host = container.getHost();
    const port = container.getMappedPort(9000);

    process.env.OBJECT_STORAGE_ENDPOINT = host;
    process.env.OBJECT_STORAGE_PORT = port.toString();
    process.env.OBJECT_STORAGE_BUCKET = bucket;
    process.env.OBJECT_STORAGE_USE_SSL = 'false';

    env = parseEnv(process.env);
  }, 120_000);

  afterAll(async () => {
    if (container && !runtimeError) {
      await container.stop();
    }

    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (runtimeError || databaseError) {
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

  it('persists save states and returns the latest blob', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const token = await getAccessToken();
    const romId = await createRom();

    const saveData = Buffer.from('state-blob');
    const saveResponse = await getApp().inject({
      method: 'POST',
      url: `/roms/${romId}/save-states`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        data: saveData.toString('base64'),
        label: 'Checkpoint 1',
        contentType: 'application/octet-stream',
      },
    });

    expect(saveResponse.statusCode).toBe(201);
    const saved = saveResponse.json() as {
      saveState: { id: string; checksum: string; size: number };
    };
    expect(saved.saveState.checksum).toBeDefined();
    expect(saved.saveState.size).toBe(saveData.byteLength);

    const latestResponse = await getApp().inject({
      method: 'GET',
      url: `/roms/${romId}/save-states/${saved.saveState.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(latestResponse.statusCode).toBe(200);
    const latestBody = latestResponse.json() as { data: string };
    expect(Buffer.from(latestBody.data, 'base64').equals(saveData)).toBe(true);
  });

  it('supports the save-state alias endpoints and latest lookup', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const token = await getAccessToken();
    const romId = await createRom();
    const payload = Buffer.from('alias-endpoint-payload');

    const aliasResponse = await getApp().inject({
      method: 'POST',
      url: `/roms/${romId}/save-state`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        data: payload.toString('base64'),
        contentType: 'application/octet-stream',
        slot: 1,
      },
    });

    expect(aliasResponse.statusCode).toBe(201);

    const latestResponse = await getApp().inject({
      method: 'GET',
      url: `/roms/${romId}/save-state/latest`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(latestResponse.statusCode).toBe(200);
    const latestBody = latestResponse.json() as {
      saveState: { slot: number; romId: string };
      data: string;
    };
    expect(latestBody.saveState.slot).toBe(1);
    expect(latestBody.saveState.romId).toBe(romId);
    expect(Buffer.from(latestBody.data, 'base64').equals(payload)).toBe(true);
  });

  it('rejects payloads that exceed the configured limit', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const token = await getAccessToken();
    const romId = await createRom();
    const oversized = Buffer.alloc(MAX_SAVE_STATE_BYTES + 1, 1);

    const response = await getApp().inject({
      method: 'POST',
      url: `/roms/${romId}/save-states`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        data: oversized.toString('base64'),
        contentType: 'application/octet-stream',
      },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({ error: 'Save state exceeds maximum allowed size' });
  });

  it('rejects refresh cookies for save state routes', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const refreshCookie = await getRefreshCookie();
    const romId = await registerRomRecord();

    const saveResponse = await getApp().inject({
      method: 'POST',
      url: `/roms/${romId}/save-states`,
      headers: { cookie: refreshCookie },
      payload: {
        data: Buffer.from('cookie-only').toString('base64'),
        contentType: 'application/octet-stream',
      },
    });

    expect(saveResponse.statusCode).toBe(401);

    const latestResponse = await getApp().inject({
      method: 'GET',
      url: `/roms/${romId}/save-states/${randomUUID()}`,
      headers: { cookie: refreshCookie },
    });

    expect(latestResponse.statusCode).toBe(401);
  });

  it('prevents users from accessing save states they do not own', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const ownerToken = await getAccessToken('owner@example.com');
    const intruderToken = await getAccessToken('intruder@example.com');
    const romId = await createRom();
    const saveData = Buffer.from('private-state');

    const saveResponse = await getApp().inject({
      method: 'POST',
      url: `/roms/${romId}/save-states`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        data: saveData.toString('base64'),
        contentType: 'application/octet-stream',
      },
    });

    expect(saveResponse.statusCode).toBe(201);
    const { saveState } = saveResponse.json() as { saveState: { id: string } };

    const unauthorizedResponse = await getApp().inject({
      method: 'GET',
      url: `/roms/${romId}/save-states/${saveState.id}`,
      headers: { Authorization: `Bearer ${intruderToken}` },
    });

    expect(unauthorizedResponse.statusCode).toBe(404);
  });
});
