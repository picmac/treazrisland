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
import { TestRomStorage } from '../../helpers/test-rom-storage';
import { ensureUserWithPassword } from '../../helpers/auth';

import type { RegisterRomInput } from '../../../src/modules/roms/rom.service';

describe('ROM catalogue routes', () => {
  let app: ReturnType<typeof createApp>;
  let env: Env;
  let romCounter = 0;
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let storage: TestRomStorage;

  const createRom = async (override?: Partial<RegisterRomInput>) => {
    romCounter += 1;
    const payload = Buffer.from(`rom-${romCounter}`);
    const staged = storage.stageUploadedAsset(
      override?.asset?.filename ?? `test-${romCounter}.zip`,
      payload,
      override?.asset?.contentType ?? 'application/zip',
    );

    return app.romService.registerRom({
      title: override?.title ?? `ROM #${romCounter}`,
      description: override?.description,
      platformId: override?.platformId ?? 'nes',
      releaseYear: override?.releaseYear ?? 1990,
      genres: override?.genres ?? ['action'],
      asset: {
        type: override?.asset?.type ?? 'ROM',
        filename: override?.asset?.filename ?? `test-${romCounter}.zip`,
        contentType: override?.asset?.contentType ?? 'application/zip',
        objectKey: override?.asset?.objectKey ?? staged.objectKey,
        checksum: override?.asset?.checksum ?? staged.checksum,
        size: override?.asset?.size ?? staged.size,
      },
    });
  };

  type TestCookie = { name: string; value: string };

  type LoginResponseBody = { accessToken: string; user: { id: string; email: string } };

  const performLogin = async (email: string) => {
    if (!database) {
      throw new Error('Test database not initialised');
    }

    await ensureUserWithPassword(database.prisma, email);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as LoginResponseBody;
    const refreshCookie = response.cookies.find(
      (cookie: TestCookie) => cookie.name === 'refreshToken',
    );

    return { body, refreshCookie };
  };

  const loginAndGetToken = async (email: string): Promise<string> => {
    const { body } = await performLogin(email);
    return body.accessToken;
  };

  const loginAndGetRefreshCookie = async (email: string): Promise<string> => {
    const { refreshCookie } = await performLogin(email);

    expect(refreshCookie).toBeDefined();
    return `${refreshCookie!.name}=${refreshCookie!.value}`;
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
      process.env.DATABASE_URL = database.connectionString;
      env = parseEnv(process.env);
    } catch (error) {
      databaseError = error as Error;
      console.warn('[public-roms] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError || !database) {
      return;
    }

    await resetDatabase(database.prisma);
    romCounter = 0;
    storage = new TestRomStorage();
    app = createApp(env, { prisma: database.prisma, romStorage: storage });
    await app.ready();
  });

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
  });

  it('lists ROMs with pagination metadata', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    await createRom({ title: 'ROM Alpha' });
    await createRom({ title: 'ROM Beta' });
    await createRom({ title: 'ROM Gamma' });

    const response = await app.inject({
      method: 'GET',
      url: '/roms?page=1&pageSize=2',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      items: Array<{ id: string; title: string }>;
      meta: { total: number; page: number; pageSize: number; totalPages: number };
    };

    expect(body.items).toHaveLength(2);
    expect(body.meta).toEqual({ total: 3, page: 1, pageSize: 2, totalPages: 2 });
  });

  it('filters ROMs by platform and genre', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const nesAction = await createRom({
      title: 'Action NES',
      platformId: 'nes',
      genres: ['Action'],
    });
    await createRom({ title: 'Puzzle SNES', platformId: 'snes', genres: ['Puzzle'] });

    const response = await app.inject({
      method: 'GET',
      url: '/roms?platform=nes&genre=action',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };

    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(nesAction.id);
  });

  it('requires authentication when filtering by favorites', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const response = await app.inject({
      method: 'GET',
      url: '/roms?favorites=true',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns favorite ROMs for authenticated users', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const romOne = await createRom({ title: 'Favorite ROM' });
    await createRom({ title: 'Other ROM' });
    const userEmail = 'player@example.com';

    const login = await performLogin(userEmail);
    await app.romService.toggleFavorite(login.body.user.id, romOne.id);
    const accessToken = login.body.accessToken;

    const response = await app.inject({
      method: 'GET',
      url: '/roms?favorites=true',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };

    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(romOne.id);
  });

  it('provides ROM metadata and asset URLs', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const payload = Buffer.from('detailed-rom');
    const staged = storage.stageUploadedAsset('detailed rom.zip', payload, 'application/zip');

    const rom = await createRom({
      title: 'Detailed ROM',
      asset: {
        type: 'ROM',
        filename: 'detailed rom.zip',
        contentType: 'application/zip',
        objectKey: staged.objectKey,
        checksum: staged.checksum,
        size: staged.size,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/roms/${rom.id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      rom: { assets: Array<{ url: string }> };
    };

    expect(body.rom.assets).toHaveLength(1);
    expect(body.rom.assets[0].url).toMatch(/^https:\/\/mock-rom-storage\/roms/);
  });

  it('surfaces platform metadata and save-state summaries when authenticated', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const rom = await createRom({ title: 'Save State Explorer', platformId: 'snes' });
    const login = await performLogin('save-slot@example.com');
    const accessToken = login.body.accessToken;

    await app.saveStateService.create({
      userId: login.body.user.id,
      romId: rom.id,
      slot: 3,
      label: 'Crystal Keep',
      binary: {
        filename: 'slot-3.sav',
        contentType: 'application/octet-stream',
        data: Buffer.from('save-state-3'),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/roms/${rom.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      rom: {
        platform?: { id: string; name: string; slug: string };
        saveStateSummary?: { total: number; latest?: { slot: number; label?: string | null } };
      };
    };

    expect(body.rom.platform?.id).toBe('snes');
    expect(body.rom.platform?.name).toBe('snes');
    expect(body.rom.saveStateSummary?.total).toBe(1);
    expect(body.rom.saveStateSummary?.latest?.slot).toBe(3);
    expect(body.rom.saveStateSummary?.latest?.label).toBe('Crystal Keep');
  });

  it('includes favorite state when the requester is authenticated', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const rom = await createRom({ title: 'Favorite aware ROM' });
    const userEmail = 'favorite-state@example.com';
    const login = await performLogin(userEmail);
    await app.romService.toggleFavorite(login.body.user.id, rom.id);
    const accessToken = login.body.accessToken;

    const response = await app.inject({
      method: 'GET',
      url: `/roms/${rom.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { rom: { isFavorite?: boolean } };

    expect(body.rom.isFavorite).toBe(true);
  });

  it('toggles favorites via the API', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const rom = await createRom({ title: 'Toggle Favorite ROM' });
    const userEmail = 'toggle@example.com';
    const accessToken = await loginAndGetToken(userEmail);

    const favoriteResponse = await app.inject({
      method: 'POST',
      url: `/roms/${rom.id}/favorite`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(favoriteResponse.statusCode).toBe(200);
    const firstBody = favoriteResponse.json() as { isFavorite: boolean };
    expect(firstBody.isFavorite).toBe(true);

    const unfavoriteResponse = await app.inject({
      method: 'POST',
      url: `/roms/${rom.id}/favorite`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(unfavoriteResponse.statusCode).toBe(200);
    const secondBody = unfavoriteResponse.json() as { isFavorite: boolean };
    expect(secondBody.isFavorite).toBe(false);
  });

  it('does not allow refresh cookies to toggle favorites', async ({ skip }) => {
    if (databaseError) {
      skip();
      return;
    }

    const rom = await createRom({ title: 'Cookie Locked ROM' });
    const refreshCookie = await loginAndGetRefreshCookie('cookie-only@example.com');

    const response = await app.inject({
      method: 'POST',
      url: `/roms/${rom.id}/favorite`,
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
