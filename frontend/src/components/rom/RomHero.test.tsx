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
  default: (props: React.ComponentProps<'img'>) => <img {...props} alt={props.alt ?? ''} />,
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

describe('RomHero favorite button', () => {
  beforeEach(() => {
    fetchRomDetailsMock.mockReset();
    fetchRomDetailsMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

    const statusMessage = await screen.findByRole('status');
    expect(statusMessage).toHaveTextContent('Added to favorites.');
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

    const statusMessage = await screen.findByRole('status');
    expect(statusMessage).toHaveTextContent('Network offline');
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
    const statusMessage = await screen.findByRole('status');
    expect(statusMessage).toHaveTextContent('Sign in to manage your favorites.');
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

    await screen.findByRole('status');
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
