import './setup-env';

import { createHash, randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RomService } from '../src/modules/roms/rom.service';

import {
  resetDatabase,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from './helpers/postgres';
import { TestRomStorage } from './helpers/test-rom-storage';

const buildAssetInput = (name: string) => {
  const buffer = Buffer.from(`rom-${name}`);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  return {
    filename: `${name}.zip`,
    contentType: 'application/zip',
    data: buffer.toString('base64'),
    checksum,
  };
};

describe('RomService integration', () => {
  let database: TestDatabase | null = null;
  let databaseError: Error | null = null;
  let storage: TestRomStorage;
  let service: RomService | null = null;

  const createTestUser = async (email: string) => {
    if (!database) {
      throw new Error('Database not initialized');
    }

    const normalizedEmail = email.toLowerCase();
    const baseUsername =
      normalizedEmail
        .split('@')[0]
        .replace(/[^a-z0-9_]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'player';
    const username = `${baseUsername}_${randomUUID().slice(0, 8)}`.slice(0, 32);

    return database.prisma.user.create({
      data: {
        email: normalizedEmail,
        username,
        passwordHash: 'test-hash',
      },
    });
  };

  beforeAll(async () => {
    try {
      database = await startTestDatabase();
    } catch (error) {
      databaseError = error as Error;
      console.warn('[rom-service] Skipping Postgres integration tests:', databaseError.message);
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase(database);
  });

  beforeEach(async () => {
    if (databaseError || !database) {
      return;
    }

    storage = new TestRomStorage();
    await resetDatabase(database.prisma);
    service = new RomService(database.prisma, storage);
  });

  afterEach(async () => {
    await resetDatabase(database?.prisma);
    service = null;
  });

  it('registers ROM metadata and returns signed asset URLs', async ({ skip }) => {
    if (databaseError || !service) {
      skip();
      return;
    }

    const activeService = service;
    const rom = await activeService.registerRom({
      title: 'Service Registered ROM',
      platformId: 'nes',
      releaseYear: 1990,
      genres: ['Action', 'Adventure'],
      asset: { type: 'ROM', ...buildAssetInput('service-rom') },
    });

    expect(rom.id).toBeTypeOf('string');
    expect(rom.assets).toHaveLength(1);

    const [asset] = rom.assets;
    expect(asset.url).toMatch(/^https:\/\/mock-rom-storage\//);
    expect(asset.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('lists ROMs with filtering and pagination', async ({ skip }) => {
    if (databaseError || !service) {
      skip();
      return;
    }

    const activeService = service;
    const action = await activeService.registerRom({
      title: 'Action NES',
      platformId: 'nes',
      genres: ['Action'],
      asset: { type: 'ROM', ...buildAssetInput('action-nes') },
    });

    await activeService.registerRom({
      title: 'Puzzle SNES',
      platformId: 'snes',
      genres: ['Puzzle'],
      asset: { type: 'ROM', ...buildAssetInput('puzzle-snes') },
    });

    const user = await createTestUser('player@example.com');
    await activeService.toggleFavorite(user.id, action.id);

    const filtered = await activeService.list({
      filters: { platformId: 'nes', genre: 'action', favoriteForUserId: user.id },
      pagination: { page: 1, pageSize: 10 },
    });

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].id).toBe(action.id);
    expect(filtered.meta.total).toBe(1);
  });

  it('finds ROMs by identifier with hydrated assets', async ({ skip }) => {
    if (databaseError || !service) {
      skip();
      return;
    }

    const activeService = service;
    const created = await activeService.registerRom({
      title: 'Findable ROM',
      platformId: 'snes',
      genres: ['Adventure'],
      asset: { type: 'ROM', ...buildAssetInput('findable') },
    });

    const rom = await activeService.findById(created.id);

    expect(rom).toBeDefined();
    expect(rom?.assets[0].url).toMatch(/^https:\/\/mock-rom-storage\//);
  });
});
