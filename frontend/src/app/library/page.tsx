'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';

import { FilterBar } from '@/components/library/FilterBar';
import {
  RomEntry,
  RomLibraryFilters,
  getRomLibraryFilterDefaults,
  useRomLibrary
} from '@/hooks/useRomLibrary';

import styles from './library.module.css';

const CARD_WIDTH = 220;
const CARD_HEIGHT = 320;
const CELL_GAP = 16;

type GridItemData = {
  roms: RomEntry[];
  columnCount: number;
};

interface RomCardProps {
  rom: RomEntry;
}

const RomCard = ({ rom }: RomCardProps) => {
  const coverLetter = rom.title.charAt(0).toUpperCase();

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        {rom.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rom.coverUrl} alt={rom.title} loading="lazy" />
        ) : (
          <div className={styles.coverFallback} aria-hidden="true">
            {coverLetter}
          </div>
        )}
      </div>
      <div className={styles.details}>
        <h3 className={styles.title}>{rom.title}</h3>
        <div className={styles.meta}>
          <span>{rom.platform}</span>
          {rom.releaseYear ? <span>{rom.releaseYear}</span> : <span />}
        </div>
        {rom.genre && <span className={styles.tag}>{rom.genre}</span>}
      </div>
    </article>
  );
};

const Cell = ({ columnIndex, rowIndex, style, data }: GridChildComponentProps<GridItemData>) => {
  const index = rowIndex * data.columnCount + columnIndex;
  const rom = data.roms[index];

  if (!rom) {
    return null;
  }

  return (
    <div style={style} className={styles.cardWrapper}>
      <RomCard rom={rom} />
    </div>
  );
};

const LibraryPage = () => {
  const [filters, setFilters] = useState<RomLibraryFilters>(getRomLibraryFilterDefaults());
  const { roms, meta, isLoading, isError } = useRomLibrary(filters);
  const handleFiltersChange = useCallback((next: RomLibraryFilters) => {
    setFilters(next);
  }, []);

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!container) {
      return;
    }

    const updateDimensions = () => {
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [container]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  const columnWidth = CARD_WIDTH + CELL_GAP;
  const rowHeight = CARD_HEIGHT + CELL_GAP;

  const width = containerSize.width > 0 ? containerSize.width : columnWidth;
  const height = containerSize.height > 0 ? containerSize.height : rowHeight * 2;

  const columnCount = Math.max(1, Math.floor(width / columnWidth));
  const rowCount = columnCount > 0 ? Math.ceil(roms.length / columnCount) : 0;

  const gridData = useMemo<GridItemData>(
    () => ({
      roms,
      columnCount
    }),
    [roms, columnCount]
  );

  const showGrid = !isLoading && !isError && roms.length > 0;
  const showEmpty = !isLoading && !isError && roms.length === 0;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Treazrisland Library</h1>
        <p className={styles.subheading}>Browse, search and filter every ROM that is ready to boot.</p>
      </div>
      <FilterBar
        filters={filters}
        onChange={handleFiltersChange}
        availablePlatforms={meta.filters.platforms}
        availableGenres={meta.filters.genres}
        totalRoms={meta.total}
        isBusy={isLoading}
      />
      <div className={styles.gridShell} ref={containerRef}>
        {isLoading && (
          <div className={styles.gridFallback}>Loading your library…</div>
        )}
        {isError && !isLoading && (
          <div className={styles.errorState}>Unable to load the ROM library. Please try again.</div>
        )}
        {showEmpty && (
          <div className={styles.emptyState}>
            <p>No ROMs match your filters yet. Try clearing them or check back later.</p>
          </div>
        )}
        {showGrid && columnCount > 0 && rowCount > 0 && (
          <Grid
            columnCount={columnCount}
            columnWidth={columnWidth}
            height={height}
            rowCount={rowCount}
            rowHeight={rowHeight}
            width={width}
            itemData={gridData}
          >
            {Cell}
          </Grid>
        )}
      </div>
    </main>
  );
};

export default LibraryPage;
