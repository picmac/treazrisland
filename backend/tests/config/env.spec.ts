import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessEnv } from 'node:process';

const ORIGINAL_ENV = { ...process.env };

describe('config/env', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses environment variables from a provided source', async () => {
    const { parseEnv } = await import('../../src/config/env');

    const result = parseEnv({
      NODE_ENV: 'development',
      PORT: '4000',
      JWT_SECRET: 'test-secret-value-123456789012345678',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/treazrisland',
      SHADOW_DATABASE_URL: 'postgresql://user:password@localhost:5432/treazrisland_shadow',
      OBJECT_STORAGE_ENDPOINT: '127.0.0.1',
      OBJECT_STORAGE_PORT: '9000',
      OBJECT_STORAGE_USE_SSL: 'false',
      OBJECT_STORAGE_ACCESS_KEY: 'test-access',
      OBJECT_STORAGE_SECRET_KEY: 'test-secret',
      OBJECT_STORAGE_BUCKET: 'roms',
      OBJECT_STORAGE_REGION: 'us-east-1',
      OBJECT_STORAGE_PRESIGNED_TTL: '120',
    } as ProcessEnv);

    expect(result).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      JWT_SECRET: 'test-secret-value-123456789012345678',
      JWT_ACCESS_TOKEN_TTL: 900,
      JWT_REFRESH_TOKEN_TTL: 604800,
      MAGIC_LINK_TOKEN_TTL: 300,
      REDIS_URL: undefined,
      OBJECT_STORAGE_ENDPOINT: '127.0.0.1',
      OBJECT_STORAGE_PORT: 9000,
      OBJECT_STORAGE_USE_SSL: false,
      OBJECT_STORAGE_ACCESS_KEY: 'test-access',
      OBJECT_STORAGE_SECRET_KEY: 'test-secret',
      OBJECT_STORAGE_BUCKET: 'roms',
      OBJECT_STORAGE_REGION: 'us-east-1',
      OBJECT_STORAGE_PRESIGNED_TTL: 120,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/treazrisland',
      SHADOW_DATABASE_URL: 'postgresql://user:password@localhost:5432/treazrisland_shadow',
    });
  });

  it('throws an error when required variables are missing', async () => {
    const { parseEnv } = await import('../../src/config/env');

    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        PORT: '3000',
      } as ProcessEnv),
    ).toThrowError('Invalid environment configuration');
  });

  it('throws an error when variables fail validation', async () => {
    const { parseEnv } = await import('../../src/config/env');

    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        PORT: '0',
        JWT_SECRET: 'test-secret-value-123456789012345678',
      } as ProcessEnv),
    ).toThrowError('Invalid environment configuration');
  });

  it('caches parsed configuration through getEnv', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '5050';
    process.env.JWT_SECRET = 'test-secret-value-123456789012345678';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/treazrisland';
    process.env.SHADOW_DATABASE_URL = 'postgresql://user:password@localhost:5432/treazrisland_shadow';
    process.env.OBJECT_STORAGE_ENDPOINT = '127.0.0.1';
    process.env.OBJECT_STORAGE_PORT = '9000';
    process.env.OBJECT_STORAGE_ACCESS_KEY = 'cache-access';
    process.env.OBJECT_STORAGE_SECRET_KEY = 'cache-secret';
    process.env.OBJECT_STORAGE_BUCKET = 'roms';
    process.env.OBJECT_STORAGE_USE_SSL = 'false';
    process.env.OBJECT_STORAGE_REGION = 'us-east-1';
    process.env.OBJECT_STORAGE_PRESIGNED_TTL = '90';

    const { getEnv } = await import('../../src/config/env');

    const first = getEnv();
    expect(first.PORT).toBe(5050);

    process.env.PORT = '6060';
    const second = getEnv();

    expect(second).toBe(first);
    expect(second.PORT).toBe(5050);
  });
});
