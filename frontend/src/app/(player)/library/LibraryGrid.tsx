'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { RomCard } from '@/components/library/RomCard';
import type { RomSummary } from '@/types/rom';
import styles from './LibraryGrid.module.css';

const CARD_ROW_HEIGHT = 340;

interface LibraryGridProps {
  roms: RomSummary[];
  isLoading: boolean;
  isFetching: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  onToggleFavorite: (romId: string) => void;
  favoritePending?: boolean;
}

const calculateColumns = (width: number) => {
  if (width < 480) return 1;
  if (width < 768) return 2;
  if (width < 1100) return 3;
  return 4;
};

export function LibraryGrid({
  roms,
  isLoading,
  isFetching,
  hasNextPage,
  fetchNextPage,
  onToggleFavorite,
  favoritePending,
}: LibraryGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const node = parentRef.current;
    if (!node) return;

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

  const columnCount = Math.max(columns, 1);
  const rowCount = roms.length ? Math.ceil(roms.length / columnCount) : 0;
  const totalRows = hasNextPage ? rowCount + 1 : rowCount || 1;

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () =>
      parentRef.current ?? (typeof document !== 'undefined' ? document.body : null),
    estimateSize: () => CARD_ROW_HEIGHT,
    overscan: 4,
  });

  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    const lastRow = virtualItems[virtualItems.length - 1];
    if (lastRow && lastRow.index >= rowCount - 1 && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [virtualizer, rowCount, hasNextPage, isFetching, fetchNextPage]);

  const handleCardNavigate = useCallback(
    (event: KeyboardEvent<HTMLElement>, cardIndex: number) => {
      if (!parentRef.current) return;
      const totalCards = roms.length;
      if (totalCards === 0) return;

      const key = event.key;

      let targetIndex = cardIndex;
      if (key === 'ArrowRight') targetIndex = Math.min(cardIndex + 1, totalCards - 1);
      if (key === 'ArrowLeft') targetIndex = Math.max(cardIndex - 1, 0);
      if (key === 'ArrowDown') targetIndex = Math.min(cardIndex + columnCount, totalCards - 1);
      if (key === 'ArrowUp') targetIndex = Math.max(cardIndex - columnCount, 0);

      if (targetIndex !== cardIndex && targetIndex >= 0 && targetIndex < totalCards) {
        event.preventDefault();
        const target = parentRef.current.querySelector<HTMLElement>(
          `[data-card-index="${targetIndex}"]`,
        );
        target?.focus();
        virtualizer.scrollToIndex(Math.floor(targetIndex / columnCount));
      }
    },
    [columnCount, roms.length, virtualizer],
  );

  const virtualRows = virtualizer.getVirtualItems();
  const rowsToRender = virtualRows.length
    ? virtualRows
    : Array.from({ length: rowCount }, (_, index) => ({
        key: `fallback-${index}`,
        index,
        start: index * CARD_ROW_HEIGHT,
        size: CARD_ROW_HEIGHT,
      }));
  const totalHeight = virtualRows.length ? virtualizer.getTotalSize() : rowCount * CARD_ROW_HEIGHT;

  const content = useMemo(() => {
    if (!roms.length && !isLoading && !isFetching) {
      return (
        <div className={styles.emptyState} role="status">
          <p>No ROMs match the selected filters yet.</p>
          <p>Try broadening your search or upload a new drop.</p>
        </div>
      );
    }

    return (
      <div className={styles.gridInner} style={{ height: totalHeight }}>
        {rowsToRender.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems: RomSummary[] = roms.slice(startIndex, startIndex + columnCount);

          if (rowItems.length === 0) {
            return (
              <div
                key={virtualRow.key}
                className={styles.virtualRow}
                data-index={virtualRow.index}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {hasNextPage ? <div className={styles.loadingRow}>Loading more…</div> : null}
              </div>
            );
          }

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
              {rowItems.map((rom, index) => (
                <div
                  key={rom.id}
                  className={styles.cardWrapper}
                  data-card-index={startIndex + index}
                  role="gridcell"
                  tabIndex={0}
                  onKeyDown={(event) => handleCardNavigate(event, startIndex + index)}
                >
                  <RomCard
                    rom={rom}
                    onToggleFavorite={onToggleFavorite}
                    favoritePending={favoritePending}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }, [
    roms,
    isLoading,
    isFetching,
    rowsToRender,
    totalHeight,
    columnCount,
    hasNextPage,
    handleCardNavigate,
    onToggleFavorite,
    favoritePending,
  ]);

  return (
    <div
      ref={parentRef}
      className={styles.gridViewport}
      data-testid="library-grid"
      aria-live="polite"
      aria-busy={isFetching}
    >
      {content}
    </div>
  );
}
