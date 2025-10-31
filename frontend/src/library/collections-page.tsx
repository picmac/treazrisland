"use client";

import { useEffect, useState } from "react";
import { listCollections, type RomCollection } from "@lib/api/collections";
import { PixelFrame } from "@/src/components/pixel-frame";
import { CuratedListCard } from "./curated-list-card";

type FetchState = "idle" | "loading" | "error" | "loaded";

export function CollectionsPage() {
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<RomCollection[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCollections() {
      setState("loading");
      setError(null);
      try {
        const response = await listCollections();
        if (cancelled) {
          return;
        }
        setCollections(response.collections);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load collections");
          setCollections([]);
          setState("error");
        }
      }
    }

    void loadCollections();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Curated Collections</p>
          <h1 className="text-3xl font-bold text-parchment">Story-driven ROM collections</h1>
          <p className="text-sm text-parchment/80">
            Explore thematic groupings assembled by TREAZRISLAND archivists. Collections bundle ROMs
            for marathons, retrospectives, or community spotlights.
          </p>
        </header>
      </PixelFrame>

      {state === "loading" && collections.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          Sorting the vault… gathering collections.
        </div>
      )}

      {state === "error" && error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          const firstRom = collection.roms[0];
          return (
            <CuratedListCard
              key={collection.id}
              href={`/collections/${collection.slug}`}
              title={collection.title}
              description={collection.description}
              meta={collection.isPublished ? "Published" : "Draft"}
              highlight={
                firstRom
                  ? {
                      label: "Opener",
                      value: firstRom.title
                    }
                  : null
              }
              footer={`${collection.roms.length.toLocaleString()} ROM${
                collection.roms.length === 1 ? "" : "s"
              } curated`}
            />
          );
        })}
      </section>

      {state === "loaded" && collections.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          No collections have been assembled yet. Visit the admin curation tools to craft a new
          showcase.
        </div>
      )}
    </main>
  );
}
