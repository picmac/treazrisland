import { PixelFrame } from "@/src/components/pixel-frame";
import {
  fetchAdminSettings,
  type ResolvedSystemSettings,
} from "@/src/lib/api/admin/settings";
import { AdminSettingsPageClient } from "@/src/admin/settings/AdminSettingsPageClient";

export default async function AdminSettingsPage() {
  let settings: ResolvedSystemSettings;
  let initialError: string | null = null;

  try {
    settings = await fetchAdminSettings();
  } catch (error) {
    initialError =
      error instanceof Error && error.message
        ? error.message
        : "Unable to load current settings.";
    settings = {
      systemProfile: {
        instanceName: "",
        timezone: "",
      },
      storage: {
        driver: "filesystem",
        localRoot: "",
        bucketAssets: "",
        bucketRoms: "",
        bucketBios: "",
      },
      email: { provider: "none" },
      metrics: { enabled: false, allowedCidrs: [] },
      screenscraper: {},
      personalization: {},
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-[0.4em] text-primary">System Configuration Nexus</h1>
          <p className="text-sm text-slate-200">
            Tune storage engines, mail relays, telemetry, and metadata enrichment. Changes apply instantly so the island stays
            responsive for every crew member.
          </p>
        </header>
      </PixelFrame>

      <AdminSettingsPageClient initialSettings={settings} initialError={initialError} />
    </main>
  );
}
