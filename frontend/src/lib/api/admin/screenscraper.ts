import { apiFetch } from "@lib/api/client";

export type ScreenScraperStatus = {
  enabled: boolean;
  diagnostics: Record<string, unknown>;
};

export type ScreenScraperSettingsResponse = {
  defaults: ScreenScraperSettings;
  user: ScreenScraperSettings | null;
  effective: ScreenScraperSettings;
};

export type ScreenScraperSettings = {
  languagePriority: string[];
  regionPriority: string[];
  mediaTypes: string[];
  onlyBetterMedia: boolean;
  maxAssetsPerType: number;
  preferParentGames: boolean;
};

export async function getScreenScraperStatus(): Promise<ScreenScraperStatus> {
  return apiFetch("/admin/screenscraper/status");
}

export async function getScreenScraperSettings(): Promise<ScreenScraperSettingsResponse> {
  return apiFetch("/admin/screenscraper/settings");
}

export async function updateScreenScraperSettings(payload: Partial<ScreenScraperSettings>): Promise<{
  settings: ScreenScraperSettings;
}> {
  return apiFetch("/admin/screenscraper/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function enqueueScreenScraperEnrichment(
  romId: string,
  overrides?: Partial<ScreenScraperSettings>
): Promise<{ job: unknown }> {
  return apiFetch(`/admin/roms/${encodeURIComponent(romId)}/enrich`, {
    method: "POST",
    body: JSON.stringify({ overrides })
  });
}
