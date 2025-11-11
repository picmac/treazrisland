import Link from "next/link";
import type { AdminPlatform } from "@/src/lib/api/admin/platforms";
import { PixelButton } from "@/src/components/pixel";

interface AdminPlatformDirectoryProps {
  platforms: AdminPlatform[];
}

export function AdminPlatformDirectory({ platforms }: AdminPlatformDirectoryProps) {
  if (platforms.length === 0) {
    return (
      <p className="text-sm text-slate-200">
        No platforms are registered yet. Seed the catalog with the CLI or onboarding wizard before queuing ROM uploads.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {platforms.map((platform) => {
        const badgeLabel = platform.shortName ?? platform.slug.toUpperCase();

        return (
          <li
            key={platform.id}
            className="rounded-pixel border border-ink/50 bg-night/70 p-4 text-left text-sm text-parchment shadow-pixel"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-parchment">{platform.name}</h3>
              <span className="rounded-pixel border border-lagoon/50 bg-lagoon/15 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-lagoon/80">
                {badgeLabel}
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-xs text-parchment/70">
              <div className="flex items-center justify-between gap-2">
                <dt className="uppercase tracking-[0.3em] text-parchment/50">Slug</dt>
                <dd className="font-mono text-parchment/90">{platform.slug}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="uppercase tracking-[0.3em] text-parchment/50">Platform ID</dt>
                <dd className="font-mono text-parchment/90">{platform.id}</dd>
              </div>
              {platform.shortName && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="uppercase tracking-[0.3em] text-parchment/50">Short name</dt>
                  <dd className="font-mono text-parchment/90">{platform.shortName}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <PixelButton asChild variant="secondary" size="sm">
                <Link href={`/platforms/${platform.slug}`}>Open library view</Link>
              </PixelButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
