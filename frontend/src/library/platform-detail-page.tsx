"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError } from "@lib/api/client";
import { getPlatform, listRoms, type PlatformSummary, type RomListItem } from "@lib/api/library";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  LibraryFilterControls,
  type LibraryFilterState
} from "@/src/components/library-filter-controls";
import { VirtualizedGrid } from "@/src/components/virtualized-grid";
import { useVirtualizedGridResetKey } from "@/src/hooks/useVirtualizedGrid";

const DEFAULT_FILTERS: LibraryFilterState = {
  search: "",
  publisher: "",
  year: "",
  sort: "title",
  direction: "asc"
};

const PAGE_SIZE = 60;

type FetchState = "idle" | "loading" | "error" | "loaded";

type PlatformDetailPageProps = {
  slug: string;
};

export function PlatformDetailPage({ slug }: PlatformDetailPageProps) {
  const [platform, setPlatform] = useState<PlatformSummary | null>(null);
  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT_FILTERS);
  const [roms, setRoms] = useState<RomListItem[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatform() {
      setPlatform(null);
      setPlatformError(null);
      try {
        const response = await getPlatform(slug);
        if (cancelled) {
          return;
        }
        setPlatform(response.platform);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError && err.status === 404
              ? "Platform not found"
              : err instanceof Error
                ? err.message
                : "Failed to load platform metadata";
          setPlatform(null);
          setPlatformError(message);
        }
      }
    }

    void loadPlatform();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setPage(1);
  }, [filters, slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoms() {
      if (page === 1) {
        setError(null);
      }
      setState(page === 1 ? "loading" : "loaded");
      setLoadingMore(page > 1);
      try {
        const yearFilter = filters.year.trim();
        const parsedYear = Number(yearFilter);
        const response = await listRoms({
          platform: slug,
          search: filters.search.trim() || undefined,
          publisher: filters.publisher.trim() || undefined,
          year:
            yearFilter.length > 0 && Number.isFinite(parsedYear) ? Math.trunc(parsedYear) : undefined,
          sort: filters.sort,
          direction: filters.direction,
          page,
          pageSize: PAGE_SIZE
        });
        if (cancelled) {
          return;
        }
        setRoms((current) => (page === 1 ? response.roms : [...current, ...response.roms]));
        setHasMore(page * PAGE_SIZE < response.total);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ROM catalog");
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

    void loadRoms();
    return () => {
      cancelled = true;
    };
  }, [filters, page, slug]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.search.trim()) {
      parts.push(`search “${filters.search.trim()}”`);
    }
    if (filters.publisher.trim()) {
      parts.push(`publisher ${filters.publisher.trim()}`);
    }
    if (filters.year.trim()) {
      parts.push(`year ${filters.year.trim()}`);
    }
    return parts.join(", ");
  }, [filters]);

  const gridResetKey = useVirtualizedGridResetKey({ slug, filters });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-lagoon/70">Platform Detail</p>
          <h1 className="text-3xl font-bold text-parchment">
            {platform ? platform.name : `Loading ${slug}…`}
          </h1>
          {platform && (
            <p className="text-sm text-parchment/70">
              {platform.romCount} ROMs catalogued • Slug: <span className="text-parchment/90">{platform.slug}</span>
            </p>
          )}
          {platformError && (
            <p className="text-sm text-red-300">{platformError}</p>
          )}
        </header>
        <LibraryFilterControls
          value={filters}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
        {filterSummary.length > 0 && (
          <p className="text-xs uppercase tracking-widest text-parchment/60">
            Active filters: <span className="text-parchment/80">{filterSummary}</span>
          </p>
        )}
      </PixelFrame>

      {state === "loading" && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/80">
          Loading ROM manifest…
        </div>
      )}

      {state === "error" && error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-pixel border border-ink/40 bg-night/70 p-4">
        <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-parchment/60">
          <span>{roms.length} ROMs loaded</span>
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
        <div className="h-[540px]">
          <VirtualizedGrid
            items={roms}
            columns={1}
            rowHeight={160}
            overscan={3}
            resetKey={gridResetKey}
            renderItem={(rom) => <RomCard rom={rom} />}
          />
        </div>
        {state === "loaded" && roms.length === 0 && (
          <p className="mt-4 text-sm text-parchment/70">
            No ROMs match those filters. Try adjusting your search or triggering an enrichment job from
            the admin area.
          </p>
        )}
      </div>
    </main>
  );
}

type RomCardProps = {
  rom: RomListItem;
};

function RomCard({ rom }: RomCardProps) {
  const primaryMetadata = rom.metadata;
  return (
    <div className="flex h-full flex-col justify-between rounded border border-ink/40 bg-night/80 p-4 text-sm text-parchment">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-parchment">{rom.title}</h2>
          <span className="text-xs uppercase tracking-widest text-parchment/50">
            {rom.releaseYear ?? "????"}
          </span>
        </div>
        {primaryMetadata?.summary ? (
          <p className="text-xs leading-relaxed text-parchment/70 max-h-24 overflow-hidden">
            {primaryMetadata.summary}
          </p>
        ) : (
          <p className="text-xs text-parchment/50">No synopsis available yet.</p>
        )}
        {primaryMetadata?.genre && (
          <p className="text-xs text-parchment/60">Genre: {primaryMetadata.genre}</p>
        )}
        {primaryMetadata?.publisher && (
          <p className="text-xs text-parchment/60">Publisher: {primaryMetadata.publisher}</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-widest text-parchment/60">
        <span>{rom.players ? `${rom.players} player${rom.players > 1 ? "s" : ""}` : "Players TBD"}</span>
        <Link href={`/roms/${rom.id}`} className="text-lagoon hover:underline">
          View details
        </Link>
      </div>
    </div>
  );
}
