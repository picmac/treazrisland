'use client';

import { useMemo, useState } from 'react';

import { LibraryFilters } from '@/components/library/LibraryFilters';
import { ApiError } from '@/lib/apiClient';
import { useRomLibrary } from '@/hooks/useRomLibrary';
import type { RomSummary } from '@/types/rom';
import { PixellabNavigation } from '@/components/chrome';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { LibraryGrid } from './LibraryGrid';
import { StatusPill } from '@/components/ui/StatusPill';
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

  const handleResetFilters = () => {
    setFilters({ favoritesOnly: false, order: 'recent', platform: undefined, genre: undefined });
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
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
          { href: '/admin/roms/upload', label: 'Upload' },
        ]}
        eyebrow="Treazr Library"
        description="Browse, filter, and favorite ROMs with EmulatorJS-ready metadata."
        actions={<SignOutButton />}
      />
      <main className="page-content" id="main-content">
        <div className={styles.header}>
          <p className="eyebrow">Library feed</p>
          <h1>Browse the Treazr Island ROM catalog</h1>
          <p>
            Filter by platform, hop between genres, and pin your favorites without leaving the
            Pixellab visual system. Status banners call out load states and recovery tips.
          </p>
          <div className={styles.pillRow}>
            <StatusPill tone="info">Virtualized grid</StatusPill>
            <StatusPill tone="success">Favorites toggle</StatusPill>
            <StatusPill tone="warning">Filters persist per session</StatusPill>
          </div>
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
          onReset={handleResetFilters}
        />

        {libraryQuery.meta ? (
          <div className={styles.resultsRow} role="status">
            <strong>{libraryQuery.meta.total} ROMs</strong>
            <span>
              Page {libraryQuery.meta.page} of {libraryQuery.meta.totalPages || 1}
            </span>
          </div>
        ) : null}

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
    </div>
  );
}
