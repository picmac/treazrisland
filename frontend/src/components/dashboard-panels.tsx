"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listRecentPlayStates, type RecentPlayState } from "@lib/api/player";
import { getStatsOverview, type StatsOverview } from "@lib/api/stats";
import { PixelFrame } from "./pixel-frame";

type PanelState = "idle" | "loading" | "ready" | "error";

type DashboardData = {
  stats: StatsOverview | null;
  recents: RecentPlayState[];
};

export function DashboardPanels() {
  const [data, setData] = useState<DashboardData>({ stats: null, recents: [] });
  const [state, setState] = useState<PanelState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setState("loading");
      setError(null);

      const [statsResult, recentsResult] = await Promise.allSettled([
        getStatsOverview(),
        listRecentPlayStates(),
      ]);

      if (cancelled) {
        return;
      }

      const nextData: DashboardData = { stats: null, recents: [] };
      let encounteredError = false;

      if (statsResult.status === "fulfilled") {
        nextData.stats = statsResult.value;
      } else {
        encounteredError = true;
      }

      if (recentsResult.status === "fulfilled") {
        nextData.recents = recentsResult.value;
      } else {
        encounteredError = true;
      }

      setData(nextData);
      setState(encounteredError ? "error" : "ready");
      if (encounteredError) {
        setError("Unable to load all dashboard data. Some information may be missing.");
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const storageSummary = useMemo(() => {
    if (!data.stats) {
      return null;
    }
    const bytes = data.stats.server.storageBytes;
    return {
      total: formatBytes(bytes.total),
      roms: formatBytes(bytes.romBinaries),
      assets: formatBytes(bytes.assets),
      playStates: formatBytes(bytes.playStates),
    };
  }, [data.stats]);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Library signals</p>
          <h2 className="text-2xl font-semibold text-parchment">Server overview</h2>
          <p className="text-sm text-parchment/70">
            Snapshot of your TREAZRISLAND deployment: total users, ROM catalog depth, and storage usage across ROMs and saves.
          </p>
        </header>
        {state === "loading" && (
          <p className="text-sm text-parchment/70">Charting the data seas…</p>
        )}
        {data.stats && storageSummary && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-pixel border border-ink/50 bg-night/60 p-4">
              <dt className="text-xs uppercase tracking-widest text-parchment/60">Crew members</dt>
              <dd className="text-2xl font-semibold text-parchment">
                {data.stats.server.users.toLocaleString()}
              </dd>
            </div>
            <div className="rounded-pixel border border-ink/50 bg-night/60 p-4">
              <dt className="text-xs uppercase tracking-widest text-parchment/60">ROM catalog</dt>
              <dd className="text-2xl font-semibold text-parchment">
                {data.stats.server.roms.toLocaleString()}
              </dd>
            </div>
            <div className="rounded-pixel border border-ink/50 bg-night/60 p-4">
              <dt className="text-xs uppercase tracking-widest text-parchment/60">Storage footprint</dt>
              <dd className="text-lg font-semibold text-parchment">{storageSummary.total}</dd>
              <dl className="mt-2 space-y-1 text-xs text-parchment/60">
                <div className="flex items-center justify-between">
                  <span>ROMs</span>
                  <span>{storageSummary.roms}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Assets</span>
                  <span>{storageSummary.assets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Play states</span>
                  <span>{storageSummary.playStates}</span>
                </div>
              </dl>
            </div>
            <div className="rounded-pixel border border-ink/50 bg-night/60 p-4">
              <dt className="text-xs uppercase tracking-widest text-parchment/60">Your uploads</dt>
              <dd className="text-lg font-semibold text-parchment">
                {data.stats.user.uploads.count.toLocaleString()} files
              </dd>
              <p className="mt-1 text-xs text-parchment/60">
                {data.stats.user.playStates.count.toLocaleString()} cloud saves totaling {formatBytes(data.stats.user.playStates.totalBytes)}
              </p>
            </div>
          </dl>
        )}
        {error && (
          <p className="rounded-pixel border border-red-600/60 bg-red-900/30 p-3 text-xs text-red-200">
            {error}
          </p>
        )}
      </PixelFrame>

      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-lagoon/70">Continue your adventure</p>
          <h2 className="text-2xl font-semibold text-parchment">Recent save states</h2>
          <p className="text-sm text-parchment/70">
            Jump back into your last sessions. Select a ROM to open the emulator with your latest cloud save ready to load.
          </p>
        </header>
        {state === "loading" && (
          <p className="text-sm text-parchment/70">Scanning logbooks…</p>
        )}
        {data.recents.length > 0 ? (
          <ul className="space-y-3">
            {data.recents.map((entry) => (
              <li key={entry.playState.id}>
                <Link
                  href={`/play/${entry.playState.romId}`}
                  className="group block rounded-pixel border border-ink/40 bg-night/60 p-4 transition hover:border-lagoon hover:bg-night/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-parchment group-hover:text-lagoon">
                      {entry.rom?.title ?? "Unknown ROM"}
                    </h3>
                    <span className="text-xs uppercase tracking-widest text-parchment/50">
                      {entry.rom?.platform?.shortName ?? entry.rom?.platform?.name ?? "Unknown"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-parchment/70">
                    {entry.playState.label ?? "Quick save"}
                    {typeof entry.playState.slot === "number" ? ` · Slot ${entry.playState.slot}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-parchment/50">
                    Updated {new Date(entry.playState.updatedAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : state !== "loading" ? (
          <p className="text-sm text-parchment/70">
            No cloud saves yet. Play a ROM and upload a save state to see it tracked here.
          </p>
        ) : null}
      </PixelFrame>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
