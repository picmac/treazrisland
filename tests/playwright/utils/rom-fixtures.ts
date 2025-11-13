import { createHash } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { backendBaseUrl } from './env';

export interface RegisteredRom {
  id: string;
  title: string;
  description?: string;
  platformId: string;
  assets: Array<{
    id: string;
    type: string;
    url: string;
    contentType: string;
    size: number;
    checksum: string;
  }>;
}

interface RegisterRomOverrides {
  title?: string;
  platformId?: string;
}

export async function registerTestRom(request: APIRequestContext, overrides: RegisterRomOverrides = {}) {
  const romLabel = overrides.title ?? `Playwright Drop ${Date.now()}`;
  const platformId = overrides.platformId ?? 'snes';
  const romBuffer = Buffer.from(`${romLabel}-${Math.random()}`);
  const encoded = romBuffer.toString('base64');
  const checksum = createHash('sha256').update(romBuffer).digest('hex');

  const response = await request.post(`${backendBaseUrl}/admin/roms`, {
    data: {
      title: romLabel,
      description: 'Automated test upload executed by Playwright.',
      platformId,
      releaseYear: 1993,
      genres: ['Action', 'Prototype'],
      asset: {
        type: 'ROM',
        filename: 'playwright-rom.smc',
        contentType: 'application/octet-stream',
        data: encoded,
        checksum
      }
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { rom: RegisteredRom };
  return payload.rom;
}
