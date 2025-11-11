"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { listRoms, type RomListItem } from "@lib/api/roms";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  LibraryFilterControls,
  type LibraryFilterState
} from "@/src/components/library-filter-controls";
import { VirtualizedGrid } from "@/src/components/virtualized-grid";
import { useVirtualizedGridResetKey } from "@/src/hooks/useVirtualizedGrid";
import { useFavorites } from "@/src/hooks/useFavorites";
import { RomCard } from "@/src/library/rom-card";

const DEFAULT_FILTERS: LibraryFilterState = {
  search: "",
  publisher: "",
  year: "",
  sort: "createdAt",
  direction: "desc",
  assetTypes: []
};

const PAGE_SIZE = 60;

type FetchState = "idle" | "loading" | "error" | "loaded";

export function FavoritesPage() {
  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT_FILTERS);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [roms, setRoms] = useState<RomListItem[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const {
    favorites,
    loading: favoritesLoading,
    error: favoritesError,
    isPending: isFavoritePending,
    toggleFavorite
  } = useFavorites();

  useEffect(() => {
    setPage(1);
  }, [filters.direction, filters.publisher, filters.search, filters.sort, filters.year, platformFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      if (page === 1) {
        setError(null);
      }
      setState(page === 1 ? "loading" : "loaded");
      setLoadingMore(page > 1);
      try {
        const publisher = filters.publisher.trim() || undefined;
        const yearFilter = filters.year.trim();
        const parsedYear = Number(yearFilter);
        const response = await listRoms({
          favoritesOnly: true,
          search: filters.search.trim() || undefined,
          publisher,
          year: yearFilter.length > 0 && Number.isFinite(parsedYear) ? Math.trunc(parsedYear) : undefined,
          sort: filters.sort,
          direction: filters.direction,
          page,
          pageSize: PAGE_SIZE,
          platform: platformFilter === "all" ? undefined : platformFilter
        });
        if (cancelled) {
          return;
        }
        setRoms((current) => (page === 1 ? response.roms : [...current, ...response.roms]));
        setHasMore(page * PAGE_SIZE < response.total);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load favorites");
          if (page === 1) {
            setRoms([]);
            setState("error");
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingMore(false);
        }
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [filters.direction, filters.publisher, filters.search, filters.sort, filters.year, page, platformFilter]);

  const favoriteSet = useMemo(() => new Set(favorites.map((favorite) => favorite.romId)), [favorites]);

  const favoriteRoms = useMemo(() => {
    if (favoritesLoading) {
      return roms;
    }
    return roms.filter((rom) => favoriteSet.has(rom.id));
  }, [favoriteSet, favoritesLoading, roms]);

  const platformOptions = useMemo(() => {
    const entries = new Map<string, string>();
    favoriteRoms.forEach((rom) => {
      entries.set(rom.platform.slug, rom.platform.shortName ?? rom.platform.name ?? rom.platform.slug);
    });
    return entries;
  }, [favoriteRoms]);

  const genreOptions = useMemo(() => {
    const entries = new Map<string, string>();
    favoriteRoms.forEach((rom) => {
      const genre = rom.metadata?.genre?.trim();
      if (genre) {
        entries.set(genre.toLowerCase(), genre);
      }
    });
    return entries;
  }, [favoriteRoms]);

  const visibleRoms = useMemo(() => {
    let filtered = favoriteRoms;
    if (platformFilter !== "all") {
      filtered = filtered.filter((rom) => rom.platform.slug === platformFilter);
    }
    if (genreFilter !== "all") {
      filtered = filtered.filter((rom) => rom.metadata?.genre?.trim().toLowerCase() === genreFilter);
    }
    return filtered;
  }, [favoriteRoms, genreFilter, platformFilter]);

  const gridResetKey = useVirtualizedGridResetKey({
    slug: `favorites-${platformFilter}-${genreFilter}`,
    filters,
    favoritesOnly: true
  });

  const romCountLabel = useMemo(() => {
    if (favoritesLoading) {
      return "Syncing your stars…";
    }
    if (visibleRoms.length === 0) {
      return "No starred adventures";
    }
    return `${visibleRoms.length} starred adventure${visibleRoms.length === 1 ? "" : "s"}`;
  }, [favoritesLoading, visibleRoms.length]);

  const handleToggleFavorite = useCallback(
    (romId: string) => toggleFavorite(romId),
    [toggleFavorite]
  );

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPlatformFilter("all");
    setGenreFilter("all");
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-lagoon/70">Favorites Log</p>
          <h1 className="text-3xl font-bold text-parchment">Starred Adventures</h1>
          <p className="text-sm text-parchment/80">
            Curate your personal queue of ROMs to replay at a moment’s notice. Filter by console or genre
            and jump straight back into the action.
          </p>
        </header>

        {favoritesError && (
          <p className="text-xs text-red-300">Favorites could not be synchronized: {favoritesError}</p>
        )}

        <section className="space-y-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-parchment/50">Filter by platform</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip
                active={platformFilter === "all"}
                onClick={() => setPlatformFilter("all")}
              >
                All
              </FilterChip>
              {Array.from(platformOptions.entries()).map(([slug, label]) => (
                <FilterChip
                  key={slug}
                  active={platformFilter === slug}
                  onClick={() => setPlatformFilter(slug)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-parchment/50">Filter by genre</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={genreFilter === "all"} onClick={() => setGenreFilter("all")}>
                All
              </FilterChip>
              {Array.from(genreOptions.entries()).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={genreFilter === value}
                  onClick={() => setGenreFilter(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
        </section>

        <LibraryFilterControls
          value={filters}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          onReset={handleReset}
          showPublisher={false}
          showYear={false}
        />
      </PixelFrame>

      {state === "loading" && visibleRoms.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/80">
          Charting the starred seas…
        </div>
      )}

      {state === "error" && error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
      )}

      <div className="rounded-pixel border border-ink/40 bg-night/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-widest text-parchment/60">
          <span>{romCountLabel}</span>
          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              className="rounded border border-lagoon px-3 py-1 text-xs font-semibold text-lagoon transition hover:bg-lagoon/20"
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
        {visibleRoms.length > 0 ? (
          <div className="h-[540px]">
            <VirtualizedGrid
              items={visibleRoms}
              columns={1}
              rowHeight={176}
              overscan={3}
              resetKey={gridResetKey}
              renderItem={(rom) => (
                <RomCard
                  rom={rom}
                  favorite={favoriteSet.has(rom.id)}
                  pending={isFavoritePending(rom.id)}
                  disabled={favoritesLoading}
                  onToggleFavorite={handleToggleFavorite}
                  showPlatform
                />
              )}
            />
          </div>
        ) : (
          state === "loaded" && (
            <p className="text-sm text-parchment/70">
              You have not starred any adventures yet. Explore the library and tap the star icon on a ROM to save
              it here for quick access.
            </p>
          )
        )}
      </div>
    </main>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pixel border px-3 py-1 text-xs uppercase tracking-widest transition ${
        active
          ? "border-lagoon bg-lagoon/20 text-lagoon"
          : "border-ink/40 bg-night/60 text-parchment/70 hover:border-lagoon hover:text-parchment"
      }`}
    >
      {children}
    </button>
  );
}
