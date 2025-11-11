import Link from "next/link";
import { PixelButton } from "@/src/components/pixel";
import { PixelFrame } from "@/src/components/pixel-frame";
import { AdminPlatformDirectory } from "@/src/admin/platforms/AdminPlatformDirectory";
import { listAdminPlatforms, type AdminPlatform } from "@/src/lib/api/admin/platforms";

function formatErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load platform catalog.";
}

export default async function AdminPlatformsPage() {
  let platforms: AdminPlatform[] = [];
  let errorMessage: string | null = null;

  try {
    const response = await listAdminPlatforms();
    platforms = response.platforms;
  } catch (error) {
    errorMessage = formatErrorMessage(error);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-[0.4em] text-primary">Platform directory</h1>
          <p className="text-sm text-slate-200">
            Verify platform slugs, short names, and IDs before importing new ROM archives. These values drive metadata
            enrichment, EmulatorJS cores, and the upload queue defaults across TREAZRISLAND.
          </p>
        </header>
        <div className="flex justify-center">
          <PixelButton asChild variant="secondary" size="sm">
            <Link href="/admin/uploads">Jump to ROM uploads</Link>
          </PixelButton>
        </div>
      </PixelFrame>

      {errorMessage ? (
        <PixelFrame className="space-y-4 bg-night/80 p-6">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold uppercase tracking-[0.3em] text-red-300">Directory unavailable</h2>
            <p className="text-sm text-slate-200">
              We couldn&apos;t reach the platform catalog. Check the backend logs, confirm your session is still valid, and try
              again.
            </p>
            <p className="rounded-pixel border border-red-500/50 bg-red-900/30 px-3 py-2 text-xs uppercase tracking-widest text-red-200">
              {errorMessage}
            </p>
          </div>
          <div className="flex justify-center">
            <PixelButton asChild size="sm">
              <Link href="/admin/platforms">Retry loading platforms</Link>
            </PixelButton>
          </div>
        </PixelFrame>
      ) : (
        <PixelFrame className="space-y-4 bg-night/80 p-6">
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-slate-300">
            <span>Registered platforms</span>
            <span>{platforms.length.toLocaleString()} total</span>
          </div>
          <AdminPlatformDirectory platforms={platforms} />
        </PixelFrame>
      )}
    </main>
  );
}
