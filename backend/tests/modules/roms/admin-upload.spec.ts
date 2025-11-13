import '../../setup-env';

import { createHash } from 'node:crypto';

import { Client } from 'minio';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';


import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';

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

  const getApp = (): NonNullable<typeof app> => {
    if (!app) {
      throw new Error('Fastify app not initialised');
    }

    return app;
  };

  beforeAll(async () => {
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
  });

  beforeEach(async () => {
    if (runtimeError) {
      return;
    }

    app = createApp(env);
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
    if (runtimeError) {
      skip();
    }

    const romData = Buffer.from('retro-bytes');
    const checksum = createHash('sha256').update(romData).digest('hex');

    const response = await getApp().inject({
      method: 'POST',
      url: '/admin/roms',
      payload: {
        title: 'Treaz test adventure',
        platformId: 'nes',
        releaseYear: 1990,
        description: 'Integration test upload',
        asset: {
          filename: 'treaz-test.zip',
          contentType: 'application/zip',
          data: romData.toString('base64'),
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
    if (runtimeError) {
      skip();
    }

    const romData = Buffer.from('retro-bytes');
    const checksum = createHash('sha256').update('something-else').digest('hex');

    const response = await getApp().inject({
      method: 'POST',
      url: '/admin/roms',
      payload: {
        title: 'Checksum mismatch',
        platformId: 'snes',
        asset: {
          filename: 'invalid.zip',
          contentType: 'application/zip',
          data: romData.toString('base64'),
          checksum,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Checksum mismatch' });
  });
});
