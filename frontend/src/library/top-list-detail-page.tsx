"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/client";
import { getTopList, type RomTopList } from "@lib/api/topLists";
import { PixelFrame } from "@/src/components/pixel-frame";
import { RankedTable } from "./ranked-table";

type FetchState = "idle" | "loading" | "error" | "loaded";

type TopListDetailPageProps = {
  slug: string;
};

export function TopListDetailPage({ slug }: TopListDetailPageProps) {
  const [state, setState] = useState<FetchState>("idle");
  const [topList, setTopList] = useState<RomTopList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTopList() {
      setState("loading");
      setError(null);
      try {
        const response = await getTopList(slug);
        if (cancelled) {
          return;
        }
        setTopList(response.topList);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError && err.status === 404
              ? "Top list not found"
              : err instanceof Error
                ? err.message
                : "Unable to load curated top list";
          setError(message);
          setTopList(null);
          setState("error");
        }
      }
    }

    void loadTopList();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const rows = useMemo(() => {
    if (!topList) {
      return [];
    }
    return topList.entries
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => ({
        id: entry.id,
        order: entry.rank,
        title: entry.title,
        subtitle: entry.platform?.shortName ?? entry.platform?.name ?? "Unknown platform",
        note: entry.blurb ?? null
      }));
  }, [topList]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Curated top list</p>
          <h1 className="text-3xl font-bold text-parchment">
            {topList ? topList.title : `Loading ${slug}…`}
          </h1>
          {topList?.description ? (
            <p className="text-sm leading-relaxed text-parchment/80">{topList.description}</p>
          ) : null}
          {topList?.publishedAt ? (
            <p className="text-xs uppercase tracking-widest text-parchment/60">
              Published {new Date(topList.publishedAt).toLocaleString()}
            </p>
          ) : null}
        </header>
      </PixelFrame>

      {state === "loading" && !topList && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          Mapping each treasure slot…
        </div>
      )}

      {error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
      )}

      {topList && (
        <RankedTable
          rows={rows}
          orderLabel="Rank"
          emptyMessage="No ROMs have been ranked in this list yet."
        />
      )}
    </main>
  );
}
