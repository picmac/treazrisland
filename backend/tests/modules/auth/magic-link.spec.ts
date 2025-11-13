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

describe('POST /auth/magic-link', () => {
  it('exchanges a valid magic link token for credentials', async () => {
    await app.ready();

    await app.sessionStore.saveMagicLinkToken('valid-token', {
      id: 'player-1',
      email: 'player@example.com',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: {
        token: 'valid-token',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { accessToken: string; user: { id: string } };

    expect(body.accessToken).toBeTypeOf('string');
    expect(body.user.id).toBe('player-1');
    expect(
      response.cookies.some((cookie: { name: string }) => cookie.name === 'refreshToken'),
    ).toBe(true);
  });

  it('rejects invalid or expired magic link tokens', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: {
        token: 'missing-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
