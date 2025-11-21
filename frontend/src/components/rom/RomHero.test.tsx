/* eslint-disable @next/next/no-img-element */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RomHero } from '@/components/rom/RomHero';
import * as apiClient from '@/lib/apiClient';
import * as authTokens from '@/lib/authTokens';
import { fetchRomDetails } from '@/lib/roms';
import type { RomDetails } from '@/types/rom';

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ ...props }: React.ComponentProps<'img'> & { priority?: boolean }) => (
    // Next.js strips the `priority` attribute from the DOM, so mirror that behavior in the mock.
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('@/lib/roms');

const fetchRomDetailsMock = vi.mocked(fetchRomDetails);

const romFixture: RomDetails = {
  id: 'rom-hero-fixture',
  title: 'Fixture Quest',
  description: 'A legendary adventure.',
  platformId: 'snes',
  releaseYear: 1994,
  genres: ['Adventure'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assets: [],
  isFavorite: false,
};

const coverAsset = {
  id: 'asset-cover',
  type: 'COVER' as const,
  checksum: 'abc123',
  contentType: 'image/png',
  size: 2048,
  createdAt: new Date().toISOString(),
  url: 'http://assets.test/cover.png',
};

const romBinaryAsset = {
  id: 'asset-rom',
  type: 'ROM' as const,
  checksum: 'def456',
  contentType: 'application/octet-stream',
  size: 4096,
  createdAt: new Date().toISOString(),
  url: 'http://assets.test/game.rom',
};

describe('RomHero media rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a hero image when a visual asset is present', () => {
    render(<RomHero rom={{ ...romFixture, assets: [coverAsset] }} />);

    expect(screen.getByRole('img', { name: `${romFixture.title} artwork` })).toBeVisible();
  });

  it('falls back to the placeholder when only non-visual assets exist', () => {
    render(<RomHero rom={{ ...romFixture, assets: [romBinaryAsset] }} />);

    expect(screen.getByText('Artwork coming soon')).toBeVisible();
    expect(screen.queryByRole('img', { name: `${romFixture.title} artwork` })).toBeNull();
  });
});

describe('RomHero favorite button', () => {
  beforeEach(() => {
    fetchRomDetailsMock.mockReset();
    fetchRomDetailsMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('disables the favorite button until hydration completes', async () => {
    vi.spyOn(authTokens, 'getStoredAccessToken').mockReturnValue('token-123');
    vi.useFakeTimers();

    try {
      render(<RomHero rom={{ ...romFixture, isFavorite: false }} />);

      const favoriteButton = screen.getByRole('button', { name: '☆ Add to favorites' });
      expect(favoriteButton).toBeDisabled();
      expect(favoriteButton).toHaveAttribute('data-ready', 'false');

      await act(async () => {
        vi.runOnlyPendingTimers();
      });

      expect(favoriteButton).not.toBeDisabled();
      expect(favoriteButton).toHaveAttribute('data-ready', 'true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces success after the backend confirms a favorite', async () => {
    vi.spyOn(authTokens, 'getStoredAccessToken').mockReturnValue('token-123');
    vi.spyOn(apiClient, 'toggleRomFavorite').mockResolvedValue({
      romId: romFixture.id,
      isFavorite: true,
    });
    const user = userEvent.setup();

    render(<RomHero rom={{ ...romFixture, isFavorite: false }} />);

    const favoriteButton = screen.getByRole('button', { name: '☆ Add to favorites' });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(favoriteButton);

    await screen.findByText('Added to favorites.', {
      selector: '[role="status"]',
    });
    expect(favoriteButton).toHaveTextContent('★ Favorited');
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores the previous state and reports errors when the backend fails', async () => {
    vi.spyOn(authTokens, 'getStoredAccessToken').mockReturnValue('token-123');
    vi.spyOn(apiClient, 'toggleRomFavorite').mockRejectedValue(new Error('Network offline'));
    const user = userEvent.setup();

    render(<RomHero rom={{ ...romFixture, isFavorite: true }} />);

    const favoriteButton = screen.getByRole('button', { name: '★ Favorited' });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(favoriteButton);

    await screen.findByText('Network offline', {
      selector: '[role="status"]',
    });
    expect(favoriteButton).toHaveTextContent('★ Favorited');
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('requires authentication before toggling favorites', async () => {
    vi.spyOn(authTokens, 'getStoredAccessToken').mockReturnValue(null);
    const toggleSpy = vi.spyOn(apiClient, 'toggleRomFavorite');
    const user = userEvent.setup();

    render(<RomHero rom={{ ...romFixture, isFavorite: false }} />);

    const favoriteButton = screen.getByRole('button', { name: '☆ Add to favorites' });

    await user.click(favoriteButton);

    expect(toggleSpy).not.toHaveBeenCalled();
    await screen.findByText('Sign in to manage your favorites.', {
      selector: '[role="status"]',
    });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores stale refresh responses that resolve after a confirmed toggle', async () => {
    vi.spyOn(authTokens, 'getStoredAccessToken').mockReturnValue('token-123');
    vi.spyOn(apiClient, 'toggleRomFavorite').mockResolvedValue({
      romId: romFixture.id,
      isFavorite: true,
    });
    let resolveRefresh: ((rom: RomDetails | null) => void) | undefined;
    fetchRomDetailsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const user = userEvent.setup();

    render(<RomHero rom={{ ...romFixture, isFavorite: false }} />);

    const favoriteButton = screen.getByRole('button', { name: '☆ Add to favorites' });

    await user.click(favoriteButton);

    await screen.findByText('Added to favorites.', { selector: '[role="status"]' });
    expect(favoriteButton).toHaveTextContent('★ Favorited');
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      resolveRefresh?.({ ...romFixture, isFavorite: false });
      await Promise.resolve();
    });

    expect(favoriteButton).toHaveTextContent('★ Favorited');
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  });
});
