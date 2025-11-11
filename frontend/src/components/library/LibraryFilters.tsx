"use client";

import clsx from "clsx";
import {
  LibraryFilterControls,
  type LibraryAssetType,
  type LibraryFilterState,
} from "@/src/components/library-filter-controls";

const ASSET_TYPE_OPTIONS: Array<{ label: string; value: LibraryAssetType }> = [
  { label: "Covers", value: "COVER" },
  { label: "Logos", value: "LOGO" },
  { label: "Screenshots", value: "SCREENSHOT" },
  { label: "Videos", value: "VIDEO" },
  { label: "Manuals", value: "MANUAL" },
  { label: "Wheels", value: "WHEEL" },
  { label: "Marquees", value: "MARQUEE" },
  { label: "Maps", value: "MAP" },
  { label: "Other", value: "OTHER" }
];

const ASSET_TYPE_ORDER = ASSET_TYPE_OPTIONS.map((option) => option.value);

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
  const normaliseAssetTypes = (selection: LibraryAssetType[]) =>
    ASSET_TYPE_ORDER.filter((value) => selection.includes(value));

  const handleToggleAssetType = (assetType: LibraryAssetType) => {
    const current = new Set(filters.assetTypes);
    if (current.has(assetType)) {
      current.delete(assetType);
    } else {
      current.add(assetType);
    }
    onFiltersChange({ assetTypes: normaliseAssetTypes(Array.from(current)) });
  };

  const handleResetAssetTypes = () => {
    onFiltersChange({ assetTypes: [] });
  };

  const hasAssetTypeFilter = filters.assetTypes.length > 0;

  return (
    <div className={clsx("flex flex-col gap-4", className)}>
      <LibraryFilterControls value={filters} onChange={onFiltersChange} onReset={onReset} />
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-parchment/70">Asset types</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetAssetTypes}
            className={clsx(
              "rounded-pixel border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] transition",
              hasAssetTypeFilter
                ? "border-ink/50 bg-night/30 text-parchment/60 hover:border-lagoon/60 hover:text-lagoon"
                : "border-lagoon/60 bg-lagoon/20 text-lagoon"
            )}
            aria-pressed={!hasAssetTypeFilter}
          >
            All assets
          </button>
          {ASSET_TYPE_OPTIONS.map((option) => {
            const active = filters.assetTypes.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggleAssetType(option.value)}
                className={clsx(
                  "rounded-pixel border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] transition",
                  active
                    ? "border-lagoon/70 bg-lagoon/25 text-lagoon"
                    : "border-ink/50 bg-night/30 text-parchment/60 hover:border-lagoon/60 hover:text-lagoon"
                )}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
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
export type { LibraryAssetType, LibraryFilterState } from "@/src/components/library-filter-controls";
