/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RomHero } from '@/components/rom/RomHero';
import { fetchRomDetails } from '@/lib/roms';
import type { RomDetails } from '@/types/rom';

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

  let fetchMock: ReturnType<typeof vi.fn>;
  let localStorageMock: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
    localStorageMock = {
      getItem: vi.fn(() => 'valid-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        configurable: true,
      });
    } else {
      vi.stubGlobal('window', { localStorage: localStorageMock });
    }
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rom: romFixture }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    if (typeof window !== 'undefined' && originalLocalStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
      });
    }
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends auth headers and renders favorited rom data when a token is available', async () => {
    const rom = await fetchRomDetails(romFixture.id);

    expect(localStorageMock.getItem).toHaveBeenCalledWith('treazr.accessToken');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/roms/${romFixture.id}`),
      expect.any(Object),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.credentials).toBe('include');
    expect(requestInit.headers).toBeInstanceOf(Headers);
    const requestHeaders = requestInit.headers as Headers;
    expect(requestHeaders.get('Authorization')).toBe('Bearer valid-token');

    expect(rom?.isFavorite).toBe(true);

    render(<RomHero rom={rom!} />);

    const favoriteButton = screen.getByRole('button', { name: /favorited/i });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  });
});
