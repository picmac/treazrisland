import '../../setup-env';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../../helpers/postgres';

import type { InviteSeed } from '../../../src/modules/invites/invite.store';

describe('POST /auth/invitations/:code/redeem', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let env: Env | null = null;

  const seedInvites = async (
    targetApp: ReturnType<typeof createApp>,
    invites: InviteSeed[],
  ): Promise<void> => {
    await targetApp.inviteStore.reset(invites);
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      env = parseEnv({ ...process.env, DATABASE_URL: database.connectionString });
    } catch (error) {
      databaseError = error as Error;
      console.warn('[invite-redeem] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError || !database || !env) {
      return;
    }

    await resetDatabase(database.prisma);
    app = createApp(env, { prisma: database.prisma });
    await app.ready();
  });

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  });

  it('redeems an invite and returns tokens', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const invite = {
      code: 'VALID-INVITE',
      expiresAt: new Date(Date.now() + 1000 * 60),
    } satisfies InviteSeed;
    await seedInvites(activeApp, [invite]);

    const response = await activeApp.inject({
      method: 'POST',
      url: `/auth/invitations/${invite.code}/redeem`,
      payload: {
        email: 'new-player@example.com',
        password: 'strong-password',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string; user: { email: string; id: string } };
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.user.email).toBe('new-player@example.com');
    expect(
      response.cookies.some((cookie: { name: string }) => cookie.name === 'refreshToken'),
    ).toBe(true);
    const storedInvite = await activeApp.inviteStore.getInvite(invite.code);
    expect(storedInvite?.redeemedAt).toBeInstanceOf(Date);
  });

  it('rejects expired invites', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const invite = { code: 'EXPIRED', expiresAt: new Date(Date.now() - 1000) } satisfies InviteSeed;
    await seedInvites(activeApp, [invite]);

    const response = await activeApp.inject({
      method: 'POST',
      url: `/auth/invitations/${invite.code}/redeem`,
      payload: {
        email: 'player@example.com',
        password: 'strong-password',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invite has expired' });
  });

  it('validates reserved email addresses', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const invite = { code: 'RESERVED', email: 'reserved@example.com' } satisfies InviteSeed;
    await seedInvites(activeApp, [invite]);

    const response = await activeApp.inject({
      method: 'POST',
      url: `/auth/invitations/${invite.code}/redeem`,
      payload: {
        email: 'different@example.com',
        password: 'strong-password',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invite is reserved for a different email' });
  });

  it('prevents duplicate redemption attempts', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const activeApp = app;
    const invite = {
      code: 'USED-INVITE',
      redeemedAt: new Date(),
      redeemedById: 'user-123',
    } satisfies InviteSeed;
    await seedInvites(activeApp, [invite]);

    const response = await activeApp.inject({
      method: 'POST',
      url: `/auth/invitations/${invite.code}/redeem`,
      payload: {
        email: 'player@example.com',
        password: 'strong-password',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'Invite already redeemed' });
  });
});
