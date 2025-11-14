import '../../setup-env';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv, type Env } from '../../../src/config/env';
import { createApp } from '../../../src/index';

import type { RegisterRomInput } from '../../../src/modules/roms/rom.service';

describe('ROM catalogue routes', () => {
  let app: ReturnType<typeof createApp>;
  let env: Env;
  let romCounter = 0;

  const createRom = (override?: Partial<RegisterRomInput>) => {
    romCounter += 1;
    return app.romService.registerRom({
      title: override?.title ?? `ROM #${romCounter}`,
      description: override?.description,
      platformId: override?.platformId ?? 'nes',
      releaseYear: override?.releaseYear ?? 1990,
      genres: override?.genres ?? ['action'],
      asset: override?.asset ?? {
        type: 'ROM',
        uri: `s3://roms/test-${romCounter}.zip`,
        objectKey: override?.asset?.objectKey ?? `roms/test-${romCounter}.zip`,
        checksum: 'a'.repeat(64),
        contentType: 'application/zip',
        size: 1024,
      },
    });
  };

  type TestCookie = { name: string; value: string };

  const performLogin = async (email: string) => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { accessToken: string };
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

  beforeEach(async () => {
    env = parseEnv(process.env);
    app = createApp(env);
    await app.ready();
    romCounter = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists ROMs with pagination metadata', async () => {
    createRom({ title: 'ROM Alpha' });
    createRom({ title: 'ROM Beta' });
    createRom({ title: 'ROM Gamma' });

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

  it('filters ROMs by platform and genre', async () => {
    const nesAction = createRom({ title: 'Action NES', platformId: 'nes', genres: ['Action'] });
    createRom({ title: 'Puzzle SNES', platformId: 'snes', genres: ['Puzzle'] });

    const response = await app.inject({
      method: 'GET',
      url: '/roms?platform=nes&genre=action',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };

    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(nesAction.id);
  });

  it('requires authentication when filtering by favorites', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/roms?favorites=true',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns favorite ROMs for authenticated users', async () => {
    const romOne = createRom({ title: 'Favorite ROM' });
    createRom({ title: 'Other ROM' });
    const userEmail = 'player@example.com';

    app.romService.toggleFavorite(userEmail, romOne.id);

    const accessToken = await loginAndGetToken(userEmail);

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

  it('provides ROM metadata and asset URLs', async () => {
    const rom = createRom({
      title: 'Detailed ROM',
      asset: {
        type: 'ROM',
        uri: 's3://roms/detailed.zip',
        objectKey: 'roms/detailed rom.zip',
        checksum: 'b'.repeat(64),
        contentType: 'application/zip',
        size: 2048,
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
    expect(body.rom.assets[0].url).toBe('http://127.0.0.1:9000/roms/roms/detailed%20rom.zip');
  });

  it('includes favorite state when the requester is authenticated', async () => {
    const rom = createRom({ title: 'Favorite aware ROM' });
    const userEmail = 'favorite-state@example.com';
    app.romService.toggleFavorite(userEmail, rom.id);

    const accessToken = await loginAndGetToken(userEmail);

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

  it('toggles favorites via the API', async () => {
    const rom = createRom({ title: 'Toggle Favorite ROM' });
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

  it('does not allow refresh cookies to toggle favorites', async () => {
    const rom = createRom({ title: 'Cookie Locked ROM' });
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
