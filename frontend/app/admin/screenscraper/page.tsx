import { PixelFrame } from "@/src/components/pixel-frame";
import {
  getScreenScraperSettings,
  getScreenScraperStatus,
  type ScreenScraperSettingsResponse,
  type ScreenScraperStatus,
} from "@/src/lib/api/admin/screenscraper";
import { ScreenScraperAdminPageClient } from "@/src/admin/screenscraper/ScreenScraperAdminPageClient";

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to load ScreenScraper details.";
}

export default async function AdminScreenScraperPage() {
  let status: ScreenScraperStatus | null = null;
  let settings: ScreenScraperSettingsResponse | null = null;
  const errors: string[] = [];

  const [statusResult, settingsResult] = await Promise.allSettled([
    getScreenScraperStatus(),
    getScreenScraperSettings(),
  ]);

  if (statusResult.status === "fulfilled") {
    status = statusResult.value;
  } else {
    errors.push(extractMessage(statusResult.reason));
  }

  if (settingsResult.status === "fulfilled") {
    settings = settingsResult.value;
  } else {
    errors.push(extractMessage(settingsResult.reason));
  }

  const initialError = errors.length > 0 ? errors.join(" \u2022 ") : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-[0.4em] text-primary">ScreenScraper Control Deck</h1>
          <p className="text-sm text-slate-200">
            Inspect service health, tune metadata enrichment defaults, and kick off ad-hoc ROM refresh jobs without leaving the
            island command bridge.
          </p>
        </header>
      </PixelFrame>

      <ScreenScraperAdminPageClient
        initialStatus={status}
        initialSettings={settings}
        initialError={initialError}
      />
    </main>
  );
}
