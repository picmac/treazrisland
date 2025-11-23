import '../../setup-env';

import { createHash } from 'node:crypto';

import { Client } from 'minio';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../../helpers/postgres';
import { ensureUserWithPassword } from '../../helpers/auth';

import type { Readable } from 'node:stream';

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

describe('POST /admin/roms', () => {
  const bucket = 'roms-integration-tests';
  let container: StartedTestContainer | null = null;
  let env: Env;
  let minioClient: Client | null = null;
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

  const getAccessToken = async (email = 'operator@example.com'): Promise<string> => {
    await ensureUserWithPassword(database!.prisma, email, { isAdmin: true });

    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string };
    return body.accessToken;
  };

  const requestUploadGrant = async (
    accessToken: string,
    file: { checksum: string; contentType: string; filename: string; size: number },
  ) => {
    const grantResponse = await getApp().inject({
      method: 'POST',
      url: '/admin/roms/uploads',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: file,
    });

    expect(grantResponse.statusCode).toBe(201);

    return grantResponse.json() as { objectKey: string; headers?: Record<string, string> };
  };

  const uploadUsingGrant = async (
    grant: { objectKey: string; headers?: Record<string, string> },
    data: Buffer,
  ) => {
    if (!minioClient) {
      throw new Error('MinIO client not initialised');
    }

    await minioClient.putObject(bucket, grant.objectKey, data, data.length, grant.headers ?? {});
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      process.env.DATABASE_URL = database.connectionString;
    } catch (error) {
      databaseError = error as Error;
      console.warn('[rom-upload] Skipping Postgres integration tests:', databaseError.message);
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
      console.warn('[rom-upload] Skipping MinIO integration tests:', runtimeError?.message);
      return;
    }

    const host = container.getHost();
    const port = container.getMappedPort(9000);

    process.env.OBJECT_STORAGE_ENDPOINT = host;
    process.env.OBJECT_STORAGE_PORT = port.toString();
    process.env.OBJECT_STORAGE_BUCKET = bucket;
    process.env.OBJECT_STORAGE_USE_SSL = 'false';

    env = parseEnv(process.env);

    minioClient = new Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: env.OBJECT_STORAGE_ACCESS_KEY,
      secretKey: env.OBJECT_STORAGE_SECRET_KEY,
      region: env.OBJECT_STORAGE_REGION,
    });
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

  it('uploads ROM assets to MinIO and registers metadata', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const romData = Buffer.from('retro-bytes');
    const checksum = createHash('sha256').update(romData).digest('hex');
    const accessToken = await getAccessToken();

    const grant = await requestUploadGrant(accessToken, {
      filename: 'treaz-test.zip',
      contentType: 'application/zip',
      size: romData.byteLength,
      checksum,
    });

    await uploadUsingGrant(grant, romData);

    const response = await getApp().inject({
      method: 'POST',
      url: '/admin/roms',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        title: 'Treaz test adventure',
        platformId: 'nes',
        releaseYear: 1990,
        description: 'Integration test upload',
        asset: {
          filename: 'treaz-test.zip',
          contentType: 'application/zip',
          objectKey: grant.objectKey,
          size: romData.byteLength,
          checksum,
          type: 'ROM',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      rom: {
        id: string;
        assets: Array<{ objectKey: string; checksum: string; size: number }>;
      };
    };

    expect(body.rom.id).toBeTypeOf('string');
    expect(body.rom.assets).toHaveLength(1);

    const [asset] = body.rom.assets;
    expect(asset.size).toBe(romData.byteLength);
    expect(asset.checksum).toBe(checksum);

    if (!minioClient) {
      throw new Error('MinIO client not initialised');
    }

    const storedObject = await minioClient.getObject(bucket, asset.objectKey);
    const storedBuffer = await streamToBuffer(storedObject as Readable);

    expect(storedBuffer.equals(romData)).toBe(true);
  });

  it('rejects uploads when the checksum does not match the payload', async ({ skip }) => {
    if (runtimeError || databaseError) {
      skip();
    }

    const romData = Buffer.from('retro-bytes');
    const checksum = createHash('sha256').update(romData).digest('hex');
    const mismatchedChecksum = createHash('sha256').update('something-else').digest('hex');
    const accessToken = await getAccessToken();

    const grant = await requestUploadGrant(accessToken, {
      filename: 'invalid.zip',
      contentType: 'application/zip',
      size: romData.byteLength,
      checksum,
    });

    await uploadUsingGrant(grant, romData);

    const response = await getApp().inject({
      method: 'POST',
      url: '/admin/roms',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        title: 'Checksum mismatch',
        platformId: 'snes',
        asset: {
          filename: 'invalid.zip',
          contentType: 'application/zip',
          objectKey: grant.objectKey,
          size: romData.byteLength,
          checksum: mismatchedChecksum,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Uploaded asset checksum mismatch' });
  });
});
