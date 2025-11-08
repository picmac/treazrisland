"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  usePlatformLibrary,
  useRomLibrary,
  type PlatformSummary,
  type RomListItem
} from "@lib/api/library";
import { PixelButton } from "@/src/components/pixel/button";
import { PixelFrame } from "@/src/components/pixel/frame";
import { PixelNotice } from "@/src/components/pixel/notice";
import {
  LibraryFilterControls,
  type LibraryFilterState
} from "@/src/components/library-filter-controls";
import { useFavorites } from "@/src/hooks/useFavorites";

const DEFAULT_FILTERS: LibraryFilterState = {
  search: "",
  publisher: "",
  year: "",
  sort: "title",
  direction: "asc"
};

type LibraryExplorerState = {
  selectedPlatform: string | null;
  favoritesOnly: boolean;
  includeEmpty: boolean;
};

const INITIAL_STATE: LibraryExplorerState = {
  selectedPlatform: null,
  favoritesOnly: false,
  includeEmpty: false
};

type LibraryExplorerPageProps = {
  initialPlatformSlug?: string | null;
};

function getPlatformLabel(platform: PlatformSummary) {
  return platform.shortName ?? platform.name ?? platform.slug.toUpperCase();
}

type RomRowProps = {
  rom: RomListItem;
  favorite: boolean;
  pending: boolean;
  onToggleFavorite: (romId: string) => void;
};

function RomRow({ rom, favorite, pending, onToggleFavorite }: RomRowProps) {
  const metadata = rom.metadata ?? null;
  const summary = Array.isArray(metadata) ? metadata[0]?.summary : metadata?.summary;
  const publisher = Array.isArray(metadata) ? metadata[0]?.publisher : metadata?.publisher;
  const genre = Array.isArray(metadata) ? metadata[0]?.genre : metadata?.genre;
  const platformLabel = rom.platform.shortName ?? rom.platform.name ?? rom.platform.slug;
  const releaseYear = rom.releaseYear ?? "????";

  return (
    <PixelFrame className="flex h-full flex-col gap-4 bg-night/80 p-4 text-sm text-parchment shadow-pixel">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-lagoon/70">
            {platformLabel.toUpperCase()}
          </p>
          <h2 className="text-xl font-semibold text-parchment">{rom.title}</h2>
        </div>
        <span className="self-start rounded-pixel bg-ink/60 px-2 py-1 text-xs uppercase tracking-widest text-parchment/80">
          {releaseYear}
        </span>
      </div>

      <div className="space-y-2">
        {summary ? (
          <p className="text-sm leading-relaxed text-parchment/80">{summary}</p>
        ) : (
          <p className="text-sm text-parchment/60">No synopsis curated yet.</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-widest text-parchment/60">
          {publisher && <span>Publisher: {publisher}</span>}
          {genre && <span>Genre: {genre}</span>}
          {rom.players && <span>{rom.players} Player{rom.players > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <PixelNotice className="bg-ink/40 text-[0.7rem] uppercase tracking-widest">
        Save-state sync coming soon — slots will appear here once linked.
      </PixelNotice>

      <div className="flex flex-wrap items-center gap-3">
        <PixelButton
          variant={favorite ? "secondary" : "primary"}
          disabled={pending}
          onClick={() => onToggleFavorite(rom.id)}
        >
          {pending ? "Saving…" : favorite ? "Favorited" : "Favorite"}
        </PixelButton>
        <Link
          href={`/play/${rom.id}`}
          className="rounded-pixel bg-kelp px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-lagoon"
        >
          Play Now
        </Link>
        <Link
          href={`/library/roms/${rom.id}`}
          className="rounded-pixel border border-lagoon/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-lagoon transition hover:border-kelp hover:text-kelp"
        >
          View Details
        </Link>
      </div>
    </PixelFrame>
  );
}

export function LibraryExplorerPage({ initialPlatformSlug = null }: LibraryExplorerPageProps = {}) {
  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT_FILTERS);
  const [state, setState] = useState<LibraryExplorerState>(() => ({
    ...INITIAL_STATE,
    selectedPlatform: initialPlatformSlug ?? INITIAL_STATE.selectedPlatform
  }));
  const listRef = useRef<HTMLDivElement | null>(null);
  const platformQuery = usePlatformLibrary({
    search: filters.search.trim() || undefined,
    includeEmpty: state.includeEmpty
  });

  const parsedYear = useMemo(() => {
    if (filters.year.trim().length === 0) {
      return undefined;
    }
    const value = Number.parseInt(filters.year.trim(), 10);
    return Number.isFinite(value) ? value : undefined;
  }, [filters.year]);

  const romQuery = useRomLibrary({
    platform: state.selectedPlatform ?? undefined,
    search: filters.search.trim() || undefined,
    publisher: filters.publisher.trim() || undefined,
    year: parsedYear,
    sort: filters.sort,
    direction: filters.direction,
    favoritesOnly: state.favoritesOnly
  });

  const { isFavorite, toggleFavorite, isPending } = useFavorites();

  const platforms = useMemo(() => platformQuery.data?.platforms ?? [], [platformQuery.data]);

  useEffect(() => {
    if (!initialPlatformSlug) {
      return;
    }
    setState((current) => {
      if (current.selectedPlatform === initialPlatformSlug) {
        return current;
      }
      return { ...current, selectedPlatform: initialPlatformSlug };
    });
  }, [initialPlatformSlug]);

  useEffect(() => {
    if (state.selectedPlatform || platforms.length === 0) {
      return;
    }
    const fallback = platforms.find((platform) => platform.slug === initialPlatformSlug)?.slug;
    setState((current) => ({
      ...current,
      selectedPlatform: fallback ?? platforms[0]?.slug ?? null
    }));
  }, [initialPlatformSlug, platforms, state.selectedPlatform]);

  const roms = romQuery.data?.roms ?? [];

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: roms.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 260,
    overscan: 6
  });

  useEffect(() => {
    virtualizer.measure();
  }, [roms.length, virtualizer]);

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.slug === state.selectedPlatform) ?? null,
    [platforms, state.selectedPlatform]
  );

  const handleSelectPlatform = (slug: string) => {
    setState((current) => ({ ...current, selectedPlatform: slug }));
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0 });
    }
  };

  const showEmptyState = !romQuery.isLoading && roms.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Library Explorer</p>
          <h1 className="text-3xl font-bold text-parchment">Discover the vault</h1>
          <p className="text-sm leading-relaxed text-parchment/80">
            Chart curated ROMs across every anchored platform. Filter by publisher, release year, or
            focus on your favorites to find the next classic to boot.
          </p>
        </header>
        {/* TODO: Prepare curated SNES artwork spritesheets for the hero banner. */}
        <div className="flex flex-col gap-4">
          <LibraryFilterControls
            value={filters}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-parchment/70">
              <input
                type="checkbox"
                checked={state.includeEmpty}
                onChange={(event) =>
                  setState((current) => ({ ...current, includeEmpty: event.target.checked }))
                }
                className="h-4 w-4 rounded border-ink/50 bg-night text-lagoon focus:ring-lagoon"
              />
              Show empty platforms
            </label>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-parchment/70">
              <input
                type="checkbox"
                checked={state.favoritesOnly}
                onChange={(event) =>
                  setState((current) => ({ ...current, favoritesOnly: event.target.checked }))
                }
                className="h-4 w-4 rounded border-ink/50 bg-night text-lagoon focus:ring-lagoon"
              />
              Favorites only
            </label>
          </div>
        </div>
      </PixelFrame>

      <section className="grid gap-6 md:grid-cols-[minmax(0,16rem)_1fr]">
        <PixelFrame className="flex h-full flex-col gap-3 bg-night/85 p-4 text-sm text-parchment shadow-pixel">
          <h2 className="text-lg font-semibold text-parchment">Platforms</h2>
          {platformQuery.isLoading && (
            <p className="text-xs text-parchment/70">Mapping systems…</p>
          )}
          {platformQuery.error && (
            <PixelNotice tone="error">{platformQuery.error.message}</PixelNotice>
          )}
          <div className="flex flex-col gap-2">
            {platforms.map((platform) => {
              const isSelected = platform.slug === state.selectedPlatform;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => handleSelectPlatform(platform.slug)}
                  className={`rounded-pixel border px-3 py-2 text-left text-xs uppercase tracking-widest transition ${
                    isSelected
                      ? "border-lagoon bg-lagoon/20 text-parchment"
                      : "border-ink/40 bg-night/50 text-parchment/70 hover:border-lagoon hover:text-parchment"
                  }`}
                >
                  <span className="block text-sm font-semibold text-parchment">
                    {platform.name}
                  </span>
                  <span className="block text-[0.65rem] uppercase tracking-[0.4em] text-parchment/60">
                    {getPlatformLabel(platform)} • {platform.romCount} ROM{platform.romCount === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
            {platforms.length === 0 && !platformQuery.isLoading && (
              <p className="text-xs text-parchment/60">No platforms match the current filters.</p>
            )}
          </div>
        </PixelFrame>

        <div className="flex flex-col gap-4">
          <PixelFrame className="space-y-2 bg-night/85 p-4 text-sm text-parchment shadow-pixel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-lagoon/70">ROM catalog</p>
                <h2 className="text-2xl font-semibold text-parchment">
                  {selectedPlatform?.name ?? "Select a platform"}
                </h2>
              </div>
              {romQuery.isValidating && (
                <span className="rounded-pixel bg-ink/60 px-2 py-1 text-xs uppercase tracking-widest text-parchment/70">
                  Refreshing…
                </span>
              )}
            </div>
            {romQuery.error && <PixelNotice tone="error">{romQuery.error.message}</PixelNotice>}
          </PixelFrame>

          <div className="relative h-[70vh] rounded-pixel border border-ink/40 bg-night/70 p-2">
            {romQuery.isLoading && roms.length === 0 && (
              <p className="p-4 text-sm text-parchment/70">Charting ROM manifest…</p>
            )}
            {showEmptyState && (
              <p className="p-4 text-sm text-parchment/60">
                No ROMs match these filters yet. Try expanding your search or disabling the favorites
                filter.
              </p>
            )}
            <div ref={listRef} className="h-full overflow-y-auto">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: "relative"
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const rom = roms[virtualItem.index];
                  return (
                    <div
                      key={rom.id}
                      data-index={virtualItem.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualItem.start}px)`,
                        height: `${virtualItem.size}px`,
                        padding: "0.5rem"
                      }}
                    >
                      <RomRow
                        rom={rom}
                        favorite={isFavorite(rom.id)}
                        pending={isPending(rom.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LibraryExplorerPage;
