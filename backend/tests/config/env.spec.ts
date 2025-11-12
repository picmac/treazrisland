import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({ NODE_ENV: 'development', PORT: 4000 });
  });

  it('throws an error when required variables are missing', async () => {
    const { parseEnv } = await import('../../src/config/env');

    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    ).toThrowError('Invalid environment configuration');
  });

  it('throws an error when variables fail validation', async () => {
    const { parseEnv } = await import('../../src/config/env');

    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        PORT: '0',
      } as NodeJS.ProcessEnv),
    ).toThrowError('Invalid environment configuration');
  });

  it('caches parsed configuration through getEnv', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '5050';

    const { getEnv } = await import('../../src/config/env');

    const first = getEnv();
    expect(first.PORT).toBe(5050);

    process.env.PORT = '6060';
    const second = getEnv();

    expect(second).toBe(first);
    expect(second.PORT).toBe(5050);
  });
});
