'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LibraryFilters } from '@/components/library/LibraryFilters';
import { RomCard } from '@/components/library/RomCard';
import { ApiError } from '@/lib/apiClient';
import { listRoms } from '@/lib/roms';
import type { RomSummary } from '@/types/rom';
import styles from './page.module.css';

const CARD_ROW_HEIGHT = 320;
const PAGE_SIZE = 100;

interface FilterState {
  platform?: string;
  genre?: string;
  favoritesOnly: boolean;
}

export default function LibraryPage() {
  const [filters, setFilters] = useState<FilterState>({ favoritesOnly: false });
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const node = parentRef.current;
    if (!node) {
      return;
    }

    const calculateColumns = (width: number) => {
      if (width < 480) return 1;
      if (width < 768) return 2;
      if (width < 1100) return 3;
      return 4;
    };

    const updateColumns = (width: number) => {
      setColumns((current) => {
        const next = calculateColumns(width);
        return current === next ? current : next;
      });
    };

    updateColumns(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry) {
        updateColumns(entry.contentRect.width);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const romQuery = useQuery({
    queryKey: ['roms', filters.platform ?? null, filters.genre ?? null, filters.favoritesOnly],
    queryFn: () =>
      listRoms({
        pageSize: PAGE_SIZE,
        platform: filters.platform,
        genre: filters.genre,
        favorites: filters.favoritesOnly,
      }),
  });

  const roms = useMemo(() => romQuery.data?.items ?? [], [romQuery.data?.items]);
  const columnCount = Math.max(columns, 1);
  const rowCount = roms.length ? Math.ceil(roms.length / columnCount) : 0;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ROW_HEIGHT,
    overscan: 4,
  });

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

  const statusMessage = romQuery.isLoading
    ? 'Loading library…'
    : romQuery.isFetching
      ? 'Refreshing library…'
      : undefined;

  const errorMessage = romQuery.error
    ? romQuery.error instanceof ApiError
      ? romQuery.error.message
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

  const renderGridContent = () => {
    if (!roms.length && !romQuery.isLoading && !romQuery.isError) {
      return (
        <div className={styles.emptyState} role="status">
          <p>No ROMs match the selected filters yet.</p>
          <p>Try broadening your search or upload a new drop.</p>
        </div>
      );
    }

    return (
      <div className={styles.gridInner} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems: RomSummary[] = roms.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className={styles.virtualRow}
              data-index={virtualRow.index}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(240px, 1fr))`,
              }}
            >
              {rowItems.map((rom) => (
                <RomCard key={rom.id} rom={rom} />
              ))}
            </div>
          );
        })}
      </div>
    );
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
        onPlatformChange={handlePlatformChange}
        onGenreChange={handleGenreChange}
        onFavoritesToggle={handleFavoritesToggle}
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

      <div
        ref={parentRef}
        className={styles.gridViewport}
        data-testid="library-grid"
        aria-live="polite"
      >
        {renderGridContent()}
      </div>
    </main>
  );
}
