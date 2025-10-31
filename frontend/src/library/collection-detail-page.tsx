"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/client";
import { getCollection, type RomCollection } from "@lib/api/collections";
import { PixelFrame } from "@/src/components/pixel-frame";
import { RankedTable } from "./ranked-table";

type FetchState = "idle" | "loading" | "error" | "loaded";

type CollectionDetailPageProps = {
  slug: string;
};

export function CollectionDetailPage({ slug }: CollectionDetailPageProps) {
  const [state, setState] = useState<FetchState>("idle");
  const [collection, setCollection] = useState<RomCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCollection() {
      setState("loading");
      setError(null);
      try {
        const response = await getCollection(slug);
        if (cancelled) {
          return;
        }
        setCollection(response.collection);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError && err.status === 404
              ? "Collection not found"
              : err instanceof Error
                ? err.message
                : "Unable to load collection";
          setError(message);
          setCollection(null);
          setState("error");
        }
      }
    }

    void loadCollection();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const rows = useMemo(() => {
    if (!collection) {
      return [];
    }
    return collection.roms
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((rom) => ({
        id: rom.id,
        order: rom.position,
        title: rom.title,
        subtitle: rom.platform?.shortName ?? rom.platform?.name ?? "Unknown platform",
        note: rom.note ?? null
      }));
  }, [collection]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Curated collection</p>
          <h1 className="text-3xl font-bold text-parchment">
            {collection ? collection.title : `Loading ${slug}…`}
          </h1>
          {collection?.description ? (
            <p className="text-sm leading-relaxed text-parchment/80">{collection.description}</p>
          ) : null}
          <p className="text-xs uppercase tracking-widest text-parchment/60">
            {collection?.isPublished ? "Published" : "Draft"}
          </p>
        </header>
      </PixelFrame>

      {state === "loading" && !collection && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          Hoisting ROM crates…
        </div>
      )}

      {error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
      )}

      {collection && (
        <RankedTable
          rows={rows}
          orderLabel="Order"
          emptyMessage="This collection is empty. Add ROMs from the admin tools to populate it."
        />
      )}
    </main>
  );
}
