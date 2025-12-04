/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RomHero } from '@/components/rom/RomHero';
import { ACCESS_TOKEN_KEY } from '@/constants/auth';
import { ApiError, apiClient } from '@/lib/apiClient';
import { fetchRomDetails } from '@/lib/roms';
import { createServerRequestInit } from '@/lib/serverRequestInit';
import type { RomDetails } from '@/types/rom';

type CookieAwareGlobal = typeof globalThis & {
  __cookieStore?: Record<string, string>;
};

const cookieAwareGlobal = globalThis as CookieAwareGlobal;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieAwareGlobal.__cookieStore?.[name];
      return value ? { name, value } : undefined;
    },
    toString: () =>
      Object.entries(cookieAwareGlobal.__cookieStore ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join('; '),
  }),
  headers: async () => new Headers(),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ComponentProps<'img'>) => <img {...props} alt={props.alt ?? ''} />,
}));

describe('fetchRomDetails', () => {
  const romFixture: RomDetails = {
    id: 'favorite-rom',
    title: 'Favorite Adventure',
    description: 'A beloved classic.',
    platformId: 'nes',
    releaseYear: 1991,
    genres: ['Adventure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: [],
    isFavorite: true,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cookieAwareGlobal.__cookieStore = undefined;
  });

  it('loads rom details through the API client and renders the hero', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ rom: romFixture } satisfies { rom: RomDetails });

    const rom = await fetchRomDetails(romFixture.id);

    expect(getSpy).toHaveBeenCalledWith(`/roms/${romFixture.id}`);
    expect(rom?.isFavorite).toBe(true);

    render(<RomHero rom={rom!} />);

    const playNowLink = screen.getByRole('link', { name: /Play Now/i });
    expect(playNowLink).toHaveAttribute('href', `/play/${romFixture.id}`);

    const favoriteButton = screen.getByRole('button', { name: /favorited/i });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns null when the rom is not found', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError('Not found', 404));

    await expect(fetchRomDetails(romFixture.id)).resolves.toBeNull();
  });

  it('falls back to fetch when server request init is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rom: { ...romFixture, isFavorite: undefined } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getSpy = vi.spyOn(apiClient, 'get');

    const rom = await fetchRomDetails(romFixture.id, {
      headers: { 'x-forwarded-host': 'example.test' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/roms/${romFixture.id}`),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(getSpy).not.toHaveBeenCalled();
    expect(rom?.isFavorite).toBe(false);
  });

  it('forwards an authorization header derived from the access token cookie', async () => {
    const cookieAccessToken = 'cookie-access-token-456';
    const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
      const urlString = String(url);

      if (urlString.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accessToken: cookieAccessToken }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ rom: romFixture }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    cookieAwareGlobal.__cookieStore = {
      [ACCESS_TOKEN_KEY]: cookieAccessToken,
    };

    const requestInit = await createServerRequestInit();
    expect(requestInit).toBeDefined();

    await fetchRomDetails(romFixture.id, requestInit);

    const romCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes(`/roms/${romFixture.id}`),
    );
    expect(romCall).toBeDefined();
    const [, forwardedInit] = romCall!;
    const forwardedHeaders = new Headers(forwardedInit.headers);
    expect(forwardedHeaders.get('authorization')).toBe(`Bearer ${cookieAccessToken}`);
  });
});
