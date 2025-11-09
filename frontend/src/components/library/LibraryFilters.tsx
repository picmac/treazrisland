"use client";

import clsx from "clsx";
import {
  LibraryFilterControls,
  type LibraryFilterState,
} from "@/src/components/library-filter-controls";

type LibraryFiltersProps = {
  filters: LibraryFilterState;
  onFiltersChange: (value: Partial<LibraryFilterState>) => void;
  onReset: () => void;
  includeEmpty: boolean;
  onIncludeEmptyChange: (value: boolean) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  className?: string;
};

export function LibraryFilters({
  filters,
  onFiltersChange,
  onReset,
  includeEmpty,
  onIncludeEmptyChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  className
}: LibraryFiltersProps) {
  return (
    <div className={clsx("flex flex-col gap-4", className)}>
      <LibraryFilterControls value={filters} onChange={onFiltersChange} onReset={onReset} />
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-parchment/70">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(event) => onIncludeEmptyChange(event.target.checked)}
            className="h-4 w-4 rounded border-ink/50 bg-night text-lagoon focus:ring-lagoon"
          />
          Show empty platforms
        </label>
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-parchment/70">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
            className="h-4 w-4 rounded border-ink/50 bg-night text-lagoon focus:ring-lagoon"
          />
          Favorites only
        </label>
      </div>
    </div>
  );
}

export default LibraryFilters;
export type { LibraryFilterState } from "@/src/components/library-filter-controls";
