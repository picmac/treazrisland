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

describe('POST /auth/login', () => {
  it('returns access and refresh tokens for valid credentials', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { accessToken: string; user: { email: string } };

    expect(body.accessToken).toBeTypeOf('string');
    expect(body.user.email).toBe('player@example.com');
    expect(
      response.cookies.some((cookie: { name: string }) => cookie.name === 'refreshToken'),
    ).toBe(true);
  });

  it('rejects invalid credentials', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'player@example.com',
        password: 'wrong-password',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('validates the login payload', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'not-an-email',
        password: 'short',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
