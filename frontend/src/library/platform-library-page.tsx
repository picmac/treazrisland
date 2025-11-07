"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listPlatforms, type PlatformSummary } from "@lib/api/library";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  LibraryFilterControls,
  type LibraryFilterState
} from "@/src/components/library-filter-controls";

const DEFAULT_FILTERS: LibraryFilterState = {
  search: "",
  publisher: "",
  year: "",
  sort: "title",
  direction: "asc"
};

type FetchState = "idle" | "loading" | "error" | "loaded";

export function PlatformLibraryPage() {
  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT_FILTERS);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatforms() {
      setState("loading");
      setError(null);
      try {
        const response = await listPlatforms({
          search: filters.search.trim() || undefined,
          includeEmpty
        });
        if (!cancelled) {
          setPlatforms(response.platforms);
          setState("loaded");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load platforms");
          setState("error");
        }
      }
    }

    void loadPlatforms();
    return () => {
      cancelled = true;
    };
  }, [filters.search, includeEmpty]);

  const visiblePlatforms = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const directionMultiplier = filters.direction === "desc" ? -1 : 1;

    const filtered = normalizedSearch
      ? platforms.filter((platform) => {
          const candidates = [
            platform.name,
            platform.shortName,
            platform.slug,
            platform.featuredRom?.title
          ].filter(Boolean) as string[];
          return candidates.some((candidate) =>
            candidate.toLowerCase().includes(normalizedSearch)
          );
        })
      : platforms.slice();

    const getSortValue = (platform: PlatformSummary) => {
      switch (filters.sort) {
        case "createdAt":
          return platform.featuredRom?.updatedAt ?? platform.featuredRom?.title ?? "";
        case "releaseYear":
          return platform.featuredRom?.updatedAt ?? platform.featuredRom?.title ?? "";
        case "publisher":
          return platform.featuredRom?.title ?? platform.name ?? platform.slug;
        case "title":
        default:
          return platform.name ?? platform.slug;
      }
    };

    const toComparable = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return value;
      }
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
      return value.toLowerCase();
    };

    return filtered.sort((a, b) => {
      const aValue = toComparable(getSortValue(a));
      const bValue = toComparable(getSortValue(b));

      if (typeof aValue === "number" && typeof bValue === "number") {
        if (aValue === bValue) {
          return 0;
        }
        return (aValue - bValue) * directionMultiplier;
      }

      const aString = String(aValue);
      const bString = String(bValue);

      if (aString === bString) {
        return 0;
      }

      return aString.localeCompare(bString) * directionMultiplier;
    });
  }, [filters.direction, filters.sort, filters.search, platforms]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Library Explorer</p>
          <h1 className="text-3xl font-bold text-parchment">Choose your platform</h1>
          <p className="text-sm text-parchment/80">
            Browse the consoles anchored at TREAZRISLAND. Tap a system to view its ROM library,
            metadata, and artwork summaries.
          </p>
        </header>
        <LibraryFilterControls
          value={filters}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          showPublisher={false}
          showYear={false}
        />
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-parchment/70">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(event) => setIncludeEmpty(event.target.checked)}
            className="h-4 w-4 rounded border-ink/50 bg-night text-lagoon focus:ring-lagoon"
          />
          Show platforms without ROMs yet
        </label>
      </PixelFrame>

      {state === "loading" && platforms.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/80">
          Charting the seas… fetching platform manifest.
        </div>
      )}

      {state === "error" && error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiblePlatforms.map((platform) => {
          const cover = platform.featuredRom?.assetSummary.cover;
          const coverUrl = cover?.externalUrl ?? null;
          const coverAlt = platform.featuredRom
            ? `${platform.featuredRom.title} cover art`
            : `${platform.name} cover art`;
          const coverWidth = cover?.width && cover.width > 0 ? cover.width : 640;
          const coverHeight = cover?.height && cover.height > 0 ? cover.height : 480;

          return (
            <Link
              key={platform.id}
              href={`/platforms/${platform.slug}`}
              className="group rounded-pixel border border-ink/40 bg-night/70 p-4 transition hover:border-lagoon hover:bg-night/80"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-parchment/60">
                <span>{platform.shortName ?? platform.slug.toUpperCase()}</span>
                <span>{platform.romCount} ROMs</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-parchment group-hover:text-lagoon">
                {platform.name}
              </h2>
              {coverUrl ? (
                <div className="mt-3 overflow-hidden rounded-pixel border border-ink/40 bg-night/60">
                  <Image
                    src={coverUrl}
                    alt={coverAlt}
                    width={coverWidth}
                    height={coverHeight}
                    className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              ) : null}
              {platform.featuredRom ? (
                <p className="mt-2 text-sm text-parchment/70">
                  Latest arrival: <span className="text-parchment">{platform.featuredRom.title}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-parchment/50">No ROMs uploaded yet.</p>
              )}
            </Link>
          );
        })}
      </section>

      {state === "loaded" && visiblePlatforms.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          No platforms match those filters yet. Adjust your search or ingest new ROMs via the admin
          uploads tool.
        </div>
      )}
    </main>
  );
}
