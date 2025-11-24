import './setup-env';

import { SessionStatus } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../src/config/env';
import { createApp } from '../src/index';
import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from './helpers/postgres';

const ADMIN_EMAIL = 'operator@treazrisland.test';
const ADMIN_PASSWORD = 'password123';

const findCookie = (response: { cookies?: Array<{ name: string; value: string }> }, name: string) =>
  response.cookies?.find((cookie) => cookie.name === name);

describe('auth bootstrap and sessions', () => {
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let env: Env | null = null;
  let app: ReturnType<typeof createApp> | null = null;

  const startApp = async (override?: Partial<Env>) => {
    if (!database || !env) {
      return;
    }

    if (app) {
      await app.close();
    }

    const mergedEnv = { ...env, ...override } as Env;
    app = createApp(mergedEnv, { prisma: database.prisma });
    await app.ready();
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      env = parseEnv({ ...process.env, DATABASE_URL: database.connectionString });
    } catch (error) {
      databaseError = error as Error;
      console.warn('[auth-spec] Skipping Postgres integration tests:', databaseError.message);
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
    await startApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('enforces bootstrap guard before creating the first admin', async ({ skip }) => {
    if (databaseError || !app) {
      skip();
      return;
    }

    const statusBefore = await app.inject({ method: 'GET', url: '/auth/bootstrap/status' });
    expect(statusBefore.statusCode).toBe(200);
    expect((statusBefore.json() as { needsBootstrap: boolean }).needsBootstrap).toBe(true);

    const bootstrap = await app.inject({ method: 'POST', url: '/auth/bootstrap' });
    expect(bootstrap.statusCode).toBe(201);

    const statusAfter = await app.inject({ method: 'GET', url: '/auth/bootstrap/status' });
    expect((statusAfter.json() as { needsBootstrap: boolean }).needsBootstrap).toBe(false);

    const duplicateBootstrap = await app.inject({ method: 'POST', url: '/auth/bootstrap' });
    expect(duplicateBootstrap.statusCode).toBe(409);
  });

  it('creates and redeems invitations after admin bootstrap', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    await app.inject({ method: 'POST', url: '/auth/bootstrap' });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    expect(loginResponse.statusCode).toBe(200);
    const accessToken = (loginResponse.json() as { accessToken: string }).accessToken;

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/auth/invitations',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'player@example.com', expiresInDays: 1 },
    });

    expect(inviteResponse.statusCode).toBe(201);
    const inviteCode = (inviteResponse.json() as { code: string }).code;

    const redeemResponse = await app.inject({
      method: 'POST',
      url: `/auth/invitations/${inviteCode}/redeem`,
      payload: { email: 'player@example.com', password: 'InvitePass123!' },
    });

    expect(redeemResponse.statusCode).toBe(200);
    const redeemedUser = (redeemResponse.json() as { user: { id: string; email: string } }).user;
    expect(redeemedUser.email).toBe('player@example.com');

    const inviteRecord = await database.prisma.invite.findUnique({ where: { code: inviteCode } });
    expect(inviteRecord?.redeemedById).toBe(redeemedUser.id);

    const activeSessions = await database.prisma.session.count({
      where: { userId: redeemedUser.id, status: SessionStatus.ACTIVE },
    });
    expect(activeSessions).toBe(1);
  });

  it('supports optional magic-link recipient verification', async ({ skip }) => {
    if (databaseError || !database || !env) {
      skip();
      return;
    }

    await app?.inject({ method: 'POST', url: '/auth/bootstrap' });

    const verifiedRequest = await app!.inject({
      method: 'POST',
      url: '/auth/magic-link/request',
      payload: { email: 'missing@example.com', redirectUrl: 'https://example.com' },
    });

    expect(verifiedRequest.statusCode).toBe(404);

    await resetDatabase(database.prisma);
    await startApp({ MAGIC_LINK_VERIFY_USERS: false });
    await app!.inject({ method: 'POST', url: '/auth/bootstrap' });

    const unverifiedRequest = await app!.inject({
      method: 'POST',
      url: '/auth/magic-link/request',
      payload: { email: 'absent@example.com', redirectUrl: 'https://example.com' },
    });

    expect(unverifiedRequest.statusCode).toBe(202);
    expect((unverifiedRequest.json() as { status: string }).status).toBe('accepted');
  });

  it('rotates refresh tokens and revokes previous sessions', async ({ skip }) => {
    if (databaseError || !app || !database) {
      skip();
      return;
    }

    await app.inject({ method: 'POST', url: '/auth/bootstrap' });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    expect(loginResponse.statusCode).toBe(200);
    const initialRefresh = findCookie(loginResponse, 'refreshToken');
    expect(initialRefresh?.value).toBeDefined();

    const initialSessions = await database.prisma.session.findMany();
    expect(initialSessions).toHaveLength(1);
    expect(initialSessions[0]?.status).toBe(SessionStatus.ACTIVE);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: `refreshToken=${initialRefresh?.value}` },
      payload: {},
    });

    expect(refreshResponse.statusCode).toBe(200);
    const rotatedCookie = findCookie(refreshResponse, 'refreshToken');
    expect(rotatedCookie?.value).toBeDefined();
    expect(rotatedCookie?.value).not.toBe(initialRefresh?.value);

    const sessions = await database.prisma.session.findMany({ orderBy: { createdAt: 'asc' } });
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.status).toBe(SessionStatus.REVOKED);
    expect(sessions[1]?.status).toBe(SessionStatus.ACTIVE);
  });
});
