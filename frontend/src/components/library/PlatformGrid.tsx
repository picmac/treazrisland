"use client";

import clsx from "clsx";
import { PixelFrame } from "@/src/components/pixel/frame";
import { PixelNotice } from "@/src/components/pixel/notice";
import type { PlatformSummary } from "@lib/api/roms";

type PlatformGridProps = {
  platforms: PlatformSummary[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  className?: string;
};

export function PlatformGrid({
  platforms,
  selectedSlug,
  onSelect,
  isLoading = false,
  error = null,
  emptyMessage = "No platforms match the current filters.",
  className
}: PlatformGridProps) {
  return (
    <PixelFrame className={clsx("flex h-full flex-col gap-3 bg-night/85 p-4 text-sm text-parchment shadow-pixel", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-parchment">Platforms</h2>
        {isLoading && <span className="text-xs text-parchment/70">Mapping systems…</span>}
      </div>
      {error && <PixelNotice tone="error">{error.message}</PixelNotice>}
      <div className="grid gap-2 md:grid-cols-1">
        {platforms.map((platform) => {
          const isSelected = platform.slug === selectedSlug;
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => onSelect(platform.slug)}
              className={clsx(
                "rounded-pixel border px-3 py-2 text-left text-xs uppercase tracking-widest transition",
                isSelected
                  ? "border-lagoon bg-lagoon/20 text-parchment"
                  : "border-ink/40 bg-night/50 text-parchment/70 hover:border-lagoon hover:text-parchment"
              )}
            >
              <span className="block text-sm font-semibold text-parchment">{platform.name}</span>
              <span className="block text-[0.65rem] uppercase tracking-[0.4em] text-parchment/60">
                {(platform.shortName ?? platform.slug).toUpperCase()} • {platform.romCount} ROM
                {platform.romCount === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>
      {platforms.length === 0 && !isLoading && !error && (
        <p className="text-xs text-parchment/60">{emptyMessage}</p>
      )}
    </PixelFrame>
  );
}

export default PlatformGrid;
