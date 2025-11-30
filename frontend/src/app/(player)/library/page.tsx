'use client';

import { useMemo, useState } from 'react';

import { LibraryFilters } from '@/components/library/LibraryFilters';
import { ApiError } from '@/lib/apiClient';
import { useRomLibrary } from '@/hooks/useRomLibrary';
import type { RomSummary } from '@/types/rom';
import { LibraryGrid } from './LibraryGrid';
import styles from './page.module.css';

interface FilterState {
  platform?: string;
  genre?: string;
  favoritesOnly: boolean;
  order: 'newest' | 'recent';
}

export default function LibraryPage() {
  const [filters, setFilters] = useState<FilterState>({ favoritesOnly: false, order: 'recent' });
  const [favoriteMessage, setFavoriteMessage] = useState<string | undefined>();

  const libraryQuery = useRomLibrary({
    platform: filters.platform,
    genre: filters.genre,
    favoritesOnly: filters.favoritesOnly,
    order: filters.order,
    pageSize: 24,
  });

  const roms: RomSummary[] = useMemo(() => libraryQuery.items ?? [], [libraryQuery.items]);
  const platformOptions = useMemo(() => {
    const unique = new Set<string>();
    roms.forEach((rom) => unique.add(rom.platformId));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [roms]);

  const genreOptions = useMemo(() => {
    const unique = new Set<string>();
    roms.forEach((rom) => rom.genres.forEach((genre) => unique.add(genre)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [roms]);

  const statusMessage = libraryQuery.isLoading
    ? 'Loading library…'
    : libraryQuery.isFetching
      ? 'Refreshing library…'
      : undefined;

  const errorMessage = libraryQuery.error
    ? libraryQuery.error instanceof ApiError
      ? libraryQuery.error.message
      : 'Unable to load ROMs right now.'
    : undefined;

  const handlePlatformChange = (platform?: string) => {
    setFilters((previous) => ({ ...previous, platform }));
  };

  const handleGenreChange = (genre?: string) => {
    setFilters((previous) => ({ ...previous, genre }));
  };

  const handleFavoritesToggle = (nextValue: boolean) => {
    setFilters((previous) => ({ ...previous, favoritesOnly: nextValue }));
  };

  const handleSortChange = (order: 'newest' | 'recent') => {
    setFilters((previous) => ({ ...previous, order }));
  };

  const handleToggleFavorite = async (romId: string) => {
    setFavoriteMessage(undefined);
    try {
      await libraryQuery.toggleFavorite(romId);
      setFavoriteMessage('Favorite status updated.');
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 401
          ? 'Sign in to manage favorites.'
          : error instanceof Error
            ? error.message
            : 'Unable to update favorites right now.';
      setFavoriteMessage(message);
    }
  };

  return (
    <main className={styles.page} id="main-content">
      <div className={styles.header}>
        <p className="eyebrow">Library feed</p>
        <h1>Browse the Treazr Island ROM catalog</h1>
        <p>
          Filter by platform, hop between genres, and pin your favorites without leaving the
          Pixellab visual system.
        </p>
      </div>

      <LibraryFilters
        platformOptions={platformOptions}
        genreOptions={genreOptions}
        selectedPlatform={filters.platform}
        selectedGenre={filters.genre}
        favoritesOnly={filters.favoritesOnly}
        sortOrder={filters.order}
        onPlatformChange={handlePlatformChange}
        onGenreChange={handleGenreChange}
        onFavoritesToggle={handleFavoritesToggle}
        onSortChange={handleSortChange}
      />

      {statusMessage && (
        <div className={styles.status} role="status">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className={styles.status} role="alert">
          {errorMessage}
        </div>
      )}

      {favoriteMessage && (
        <div className={styles.status} role="status" aria-live="polite">
          {favoriteMessage}
        </div>
      )}

      <LibraryGrid
        roms={roms}
        isLoading={libraryQuery.isLoading}
        isFetching={libraryQuery.isFetching}
        hasNextPage={libraryQuery.hasNextPage}
        fetchNextPage={libraryQuery.fetchNextPage}
        onToggleFavorite={handleToggleFavorite}
        favoritePending={libraryQuery.isFavoritePending}
      />
    </main>
  );
}
