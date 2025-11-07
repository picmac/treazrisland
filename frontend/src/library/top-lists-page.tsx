"use client";

import { useEffect, useState } from "react";
import { listTopLists, type RomTopList } from "@lib/api/topLists";
import { PixelFrame } from "@/src/components/pixel-frame";
import { CuratedListCard } from "./curated-list-card";

type FetchState = "idle" | "loading" | "error" | "loaded";

export function TopListsPage() {
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [topLists, setTopLists] = useState<RomTopList[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadTopLists() {
      setState("loading");
      setError(null);
      try {
        const response = await listTopLists();
        if (cancelled) {
          return;
        }
        setTopLists(response.topLists);
        setState("loaded");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load curated top lists");
          setState("error");
          setTopLists([]);
        }
      }
    }

    void loadTopLists();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Curated Highlights</p>
          <h1 className="text-3xl font-bold text-parchment">Top lists from the crew</h1>
          <p className="text-sm text-parchment/80">
            Discover the ranked adventures handpicked by TREAZRISLAND curators. Each list celebrates
            standout ROMs with theme, lore, and platform callouts.
          </p>
        </header>
      </PixelFrame>

      {state === "loading" && topLists.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          Charting curated waters… fetching top lists.
        </div>
      )}

      {state === "error" && error && (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topLists.map((topList) => {
          const firstEntry = topList.entries[0];
          const previewEntries = topList.entries.slice(0, 3);
          return (
            <CuratedListCard
              key={topList.id}
              href={{
                pathname: "/top-lists/[slug]",
                query: { slug: topList.slug }
              }}
              title={topList.title}
              description={topList.description}
              meta={
                topList.publishedAt
                  ? `Published ${new Date(topList.publishedAt).toLocaleDateString()}`
                  : "Draft"
              }
              highlight={
                firstEntry
                  ? {
                      label: "#1",
                      value: firstEntry.title
                    }
                  : null
              }
              footer={`${topList.entries.length.toLocaleString()} entr${
                topList.entries.length === 1 ? "y" : "ies"
              }`}
            >
              {previewEntries.length > 0 ? (
                <ul className="space-y-2">
                  {previewEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-parchment/60"
                    >
                      <span className="text-parchment font-semibold">#{entry.rank}</span>
                      <span className="flex-1 truncate text-left text-parchment/80">
                        {entry.title}
                      </span>
                      {entry.platform ? (
                        <span className="text-parchment/50">
                          {entry.platform.shortName ?? entry.platform.name}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-parchment/60">No ranked entries yet.</p>
              )}
            </CuratedListCard>
          );
        })}
      </section>

      {state === "loaded" && topLists.length === 0 && (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          No curated top lists have been published yet. Check back soon or assemble a list from the
          admin console.
        </div>
      )}
    </main>
  );
}
