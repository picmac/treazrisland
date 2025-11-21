import { createHash } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
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

  const signedHeaders = new Set(
    new URL(grant.uploadUrl)
      .searchParams.get('X-Amz-SignedHeaders')
      ?.split(';')
      .map((header) => header.toLowerCase())
      .filter(Boolean) ?? [],
  );

  const uploadHeaders = Object.fromEntries(
    Object.entries(grant.headers ?? {}).filter(
      ([header]) => signedHeaders.size === 0 || signedHeaders.has(header.toLowerCase()),
    ),
  );

  const performUpload = async (targetUrl: string, hostHeader?: string) => {
    const headers = {
      ...uploadHeaders,
      ...(hostHeader && (signedHeaders.size === 0 || signedHeaders.has('host'))
        ? { host: hostHeader }
        : {}),
    };

    return request.fetch(targetUrl, {
      method: 'PUT',
      headers,
      data: romBuffer,
    });
  };

  let uploadResponse: APIResponse | null = null;
  let uploadError: Error | null = null;

  const attemptUpload = async (targetUrl: string, hostHeader?: string) => {
    try {
      uploadResponse = await performUpload(targetUrl, hostHeader);
      uploadError = null;
    } catch (error) {
      uploadResponse = null;
      uploadError = error as Error;
    }
  };

  await attemptUpload(grant.uploadUrl);

  if (uploadError || !uploadResponse?.ok()) {
    const originalUrl = new URL(grant.uploadUrl);
    const overrideHost = process.env.PLAYWRIGHT_STORAGE_HOST_OVERRIDE ?? 'localhost:9000';

    if (overrideHost && overrideHost !== originalUrl.host) {
      const originalHost = originalUrl.host;
      originalUrl.host = overrideHost;

      await attemptUpload(originalUrl.toString(), originalHost);
    }
  }

  if (uploadError || !uploadResponse?.ok()) {
    const status = uploadResponse?.status();
    const statusText = uploadResponse?.statusText();
    const responseText = uploadResponse ? await uploadResponse.text() : null;
    const errorMessage =
      `ROM upload failed${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}` +
      `${responseText ? `: ${responseText}` : uploadError ? `: ${uploadError.message}` : ''}`;

    throw new Error(errorMessage);
  }

  if (!uploadResponse) {
    throw new Error('Upload response missing after retries');
  }

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
