import Link from "next/link";
import clsx from "clsx";
import type { RomListItem } from "@lib/api/library";

export type RomCardProps = {
  rom: RomListItem;
  favorite: boolean;
  pending: boolean;
  disabled: boolean;
  onToggleFavorite: (romId: string) => void;
  showPlatform?: boolean;
};

export function RomCard({
  rom,
  favorite,
  pending,
  disabled,
  onToggleFavorite,
  showPlatform = false
}: RomCardProps) {
  const primaryMetadata = rom.metadata;
  const buttonLabel = favorite ? "Remove from favorites" : "Add to favorites";
  const isDisabled = disabled || pending;
  const buttonClasses = clsx(
    "rounded-pixel border px-2 py-1 text-lg leading-none transition focus:outline-none focus:ring-2 focus:ring-lagoon",
    favorite
      ? "border-amber-300 bg-amber-200/10 text-amber-200"
      : "border-ink/40 bg-night/60 text-parchment/60 hover:border-lagoon hover:text-parchment",
    isDisabled && "cursor-not-allowed opacity-50 hover:border-ink/40 hover:text-parchment/60"
  );

  const platformLabel = rom.platform.shortName ?? rom.platform.name ?? rom.platform.slug.toUpperCase();

  return (
    <div className="flex h-full flex-col justify-between rounded border border-ink/40 bg-night/80 p-4 text-sm text-parchment">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                {showPlatform && (
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-lagoon/70">{platformLabel}</p>
                )}
                <h2 className="text-lg font-semibold text-parchment">{rom.title}</h2>
              </div>
              <span className="text-xs uppercase tracking-widest text-parchment/50">
                {rom.releaseYear ?? "????"}
              </span>
            </div>
            {primaryMetadata?.summary ? (
              <p className="max-h-24 overflow-hidden text-xs leading-relaxed text-parchment/70">
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
          <button
            type="button"
            className={buttonClasses}
            onClick={() => onToggleFavorite(rom.id)}
            disabled={isDisabled}
            aria-pressed={favorite}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            <span aria-hidden="true">{pending ? "…" : favorite ? "★" : "☆"}</span>
          </button>
        </div>
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
