import { createHash } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { backendBaseUrl } from './env';
import { obtainAccessToken } from './backendApi';

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

export async function registerTestRom(
  request: APIRequestContext,
  overrides: RegisterRomOverrides = {},
) {
  const romLabel = overrides.title ?? `Playwright Drop ${Date.now()}`;
  const platformId = overrides.platformId ?? 'snes';
  const romBuffer = Buffer.from(`${romLabel}-${Math.random()}`);
  const checksum = createHash('sha256').update(romBuffer).digest('hex');
  const accessToken = await obtainAccessToken(request);

  const grantResponse = await request.post(`${backendBaseUrl}/admin/roms/uploads`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      filename: 'playwright-rom.smc',
      contentType: 'application/octet-stream',
      size: romBuffer.byteLength,
      checksum,
    },
  });

  expect(grantResponse.ok()).toBeTruthy();
  const grant = (await grantResponse.json()) as {
    uploadUrl: string;
    objectKey: string;
    headers?: Record<string, string>;
  };

  const uploadResponse = await request.fetch(grant.uploadUrl, {
    method: 'PUT',
    headers: grant.headers,
    data: romBuffer,
  });

  expect(uploadResponse.ok()).toBeTruthy();

  const response = await request.post(`${backendBaseUrl}/admin/roms`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
        checksum,
        objectKey: grant.objectKey,
        size: romBuffer.byteLength,
      },
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { rom: RegisteredRom };
  return payload.rom;
}
