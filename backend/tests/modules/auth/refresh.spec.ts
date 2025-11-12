import '../../setup-env';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/index';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

afterEach(async () => {
  await app.close();
});

describe('POST /auth/refresh', () => {
  it('rotates refresh tokens and returns a new access token', async () => {
    await app.ready();

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'password123',
      },
    });

    const initialCookie = loginResponse.cookies.find((cookie) => cookie.name === 'refreshToken');

    expect(initialCookie?.value).toBeDefined();

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `refreshToken=${initialCookie?.value}`,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);

    const body = refreshResponse.json() as { accessToken: string };

    expect(body.accessToken).toBeTypeOf('string');

    const rotatedCookie = refreshResponse.cookies.find((cookie) => cookie.name === 'refreshToken');

    expect(rotatedCookie?.value).toBeDefined();
    expect(rotatedCookie?.value).not.toBe(initialCookie?.value);

    const replayResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `refreshToken=${initialCookie?.value}`,
      },
    });

    expect(replayResponse.statusCode).toBe(401);
  });

  it('rejects requests without a refresh token', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
    });

    expect(response.statusCode).toBe(401);
  });
});
