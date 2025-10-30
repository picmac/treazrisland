"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type VirtualizedGridProps<T> = {
  items: T[];
  columns: number;
  rowHeight: number;
  overscan?: number;
  gap?: string;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  resetKey?: string | number;
};

export function VirtualizedGrid<T>({
  items,
  columns,
  rowHeight,
  overscan = 2,
  gap = "1rem",
  className,
  renderItem,
  resetKey
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const previousResetKeyRef = useRef<string | number | undefined>(resetKey);
  const previousLengthRef = useRef<number>(items.length);

  const totalRows = useMemo(() => Math.ceil(items.length / columns), [items.length, columns]);
  const totalHeight = totalRows * rowHeight;

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    handleResize();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      previousResetKeyRef.current = resetKey;
      previousLengthRef.current = items.length;
      return;
    }

    const keyChanged =
      resetKey !== undefined && previousResetKeyRef.current !== undefined
        ? resetKey !== previousResetKeyRef.current
        : resetKey !== undefined && previousResetKeyRef.current === undefined;
    const keyRemoved = resetKey === undefined && previousResetKeyRef.current !== undefined;
    const lengthShrank = resetKey === undefined && items.length < previousLengthRef.current;
    const datasetCleared = items.length === 0 && previousLengthRef.current > 0;

    if (keyChanged || keyRemoved || lengthShrank || datasetCleared) {
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top: 0 });
      } else {
        container.scrollTop = 0;
      }
      setScrollTop(0);
    }

    previousResetKeyRef.current = resetKey;
    previousLengthRef.current = items.length;
  }, [items.length, resetKey]);

  const visibleRange = useMemo(() => {
    if (viewportHeight === 0) {
      const endRowFallback = Math.min(Math.ceil(items.length / columns), overscan);
      return {
        startIndex: 0,
        endIndex: Math.min(items.length, columns * overscan),
        startRow: 0,
        endRow: endRowFallback
      };
    }
    const startRow = Math.max(Math.floor(scrollTop / rowHeight) - overscan, 0);
    const endRow = Math.min(
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
      totalRows
    );
    const startIndex = startRow * columns;
    const endIndex = Math.min(endRow * columns, items.length);
    return { startIndex, endIndex, startRow, endRow };
  }, [columns, items.length, overscan, rowHeight, scrollTop, totalRows, viewportHeight]);

  const paddingTop = (visibleRange.startRow ?? 0) * rowHeight;
  const paddingBottom = totalHeight - (visibleRange.endRow ?? totalRows) * rowHeight;

  const visibleItems = useMemo(
    () => items.slice(visibleRange.startIndex, visibleRange.endIndex),
    [items, visibleRange.endIndex, visibleRange.startIndex]
  );

  return (
    <div
      ref={containerRef}
      className={clsx("h-full overflow-y-auto", className)}
      style={{ maxHeight: "100%" }}
    >
      <div style={{ height: totalHeight }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap,
            paddingTop,
            paddingBottom
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={visibleRange.startIndex + index} style={{ minHeight: rowHeight }}>
              {renderItem(item, visibleRange.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
