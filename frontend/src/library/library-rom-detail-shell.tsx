"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRomDetail } from "@lib/api/roms";
import { PixelFrame } from "@/src/components/pixel/frame";
import { PixelNotice } from "@/src/components/pixel/notice";
import { useFavorites } from "@/src/hooks/useFavorites";
import { FavoriteToggle } from "@components/library/FavoriteToggle";

type LibraryRomDetailShellProps = {
  romId: string;
};

export function LibraryRomDetailShell({ romId }: LibraryRomDetailShellProps) {
  const { data, error, isLoading, isValidating, refresh } = useRomDetail(romId);
  const { isFavorite, toggleFavorite, isPending } = useFavorites();

  const primaryMetadata = useMemo(() => data?.metadata?.[0] ?? null, [data?.metadata]);
  const platformLabel = data?.platform.shortName ?? data?.platform.name ?? data?.platform.slug;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-lagoon/70">ROM Detail</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-parchment">{data?.title ?? "Loading ROM"}</h1>
              {platformLabel && (
                <p className="text-xs uppercase tracking-[0.35em] text-parchment/70">
                  Platform: {platformLabel.toUpperCase()} • ROM ID: {romId}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FavoriteToggle
                romId={romId}
                favorite={isFavorite(romId)}
                pending={isPending(romId)}
                onToggle={toggleFavorite}
              />
              {data && (
                <Link
                  href={`/play/${data.id}`}
                  className="rounded-pixel bg-kelp px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-lagoon"
                >
                  Launch Emulator
                </Link>
              )}
            </div>
          </div>
          {isValidating && (
            <span className="inline-flex rounded-pixel bg-ink/60 px-2 py-1 text-xs uppercase tracking-widest text-parchment/70">
              Refreshing…
            </span>
          )}
        </header>

        {isLoading && (
          <p className="text-sm text-parchment/70">Gathering manifest…</p>
        )}

        {error && <PixelNotice tone="error">{error.message}</PixelNotice>}

        {data && (
          <div className="space-y-6 text-sm text-parchment/80">
            {primaryMetadata?.summary && (
              <section className="space-y-2">
                <h2 className="text-lg font-semibold text-parchment">Synopsis</h2>
                <p className="leading-relaxed">{primaryMetadata.summary}</p>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-parchment">Metadata</h2>
              <ul className="space-y-1 text-sm">
                <li>Release year: {data.releaseYear ?? "????"}</li>
                <li>Players: {data.players ?? "?"}</li>
                {primaryMetadata?.publisher && <li>Publisher: {primaryMetadata.publisher}</li>}
                {primaryMetadata?.developer && <li>Developer: {primaryMetadata.developer}</li>}
                {primaryMetadata?.genre && <li>Genre: {primaryMetadata.genre}</li>}
                <li>ROM size: {formatBytes(data.romSize)}</li>
                <li>SHA-256: {data.binary?.checksumSha256 ?? "Unavailable"}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-parchment">Assets</h2>
              {data.assets.length === 0 ? (
                <p className="text-parchment/60">No curated assets yet.</p>
              ) : (
                <ul className="space-y-1">
                  {data.assets.map((asset) => (
                    <li key={asset.id} className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest">
                      <span>
                        {asset.type} • {asset.source}
                        {asset.language ? ` • ${asset.language}` : ""}
                        {asset.region ? ` • ${asset.region}` : ""}
                      </span>
                      <span className="text-parchment/50">
                        {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <PixelNotice className="bg-ink/40 text-[0.7rem] uppercase tracking-widest">
              Save-state slots will appear here once cloud sync is enabled for this ROM.
            </PixelNotice>

            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-lagoon">
              <Link href={`/library`} className="hover:underline">
                Back to library
              </Link>
              {platformLabel && (
                <Link href={`/library/${data?.platform.slug}`} className="hover:underline">
                  View more {platformLabel.toUpperCase()} ROMs
                </Link>
              )}
              <button
                type="button"
                onClick={() => refresh()}
                className="rounded-pixel border border-lagoon/60 px-3 py-1 text-xs uppercase tracking-widest text-lagoon transition hover:border-kelp hover:text-kelp"
              >
                Refresh details
              </button>
            </div>
          </div>
        )}
      </PixelFrame>
    </main>
  );
}

function formatBytes(size: number | null | undefined) {
  if (!size || size <= 0) {
    return "Unknown";
  }
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}

export default LibraryRomDetailShell;
