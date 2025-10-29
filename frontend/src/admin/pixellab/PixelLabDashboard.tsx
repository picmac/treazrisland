"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  getPixelLabCache,
  listPixelLabRenders,
  regeneratePixelLabRender,
  requestPixelLabRender,
  type PixelLabCacheEntrySummary,
  type PixelLabCacheSummary,
  type PixelLabRenderSummary
} from "@/src/lib/api/admin/pixellab";
import {
  getScreenScraperSettings,
  getScreenScraperStatus,
  type ScreenScraperSettingsResponse,
  type ScreenScraperStatus
} from "@/src/lib/api/admin/screenscraper";

export function PixelLabDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<PixelLabRenderSummary[]>([]);
  const [cache, setCache] = useState<PixelLabCacheSummary | null>(null);
  const [formState, setFormState] = useState({
    romId: "",
    prompt:
      "Craft a 16-bit SNES hero illustration with warm Monkey Island lighting, highlighting the ROM's title scene.",
    styleId: "",
    submitting: false,
    message: ""
  });
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [screenScraperStatus, setScreenScraperStatus] = useState<ScreenScraperStatus | null>(null);
  const [screenScraperSettings, setScreenScraperSettings] =
    useState<ScreenScraperSettingsResponse | null>(null);
  const [screenScraperError, setScreenScraperError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [renderResponse, cacheResponse] = await Promise.all([
        listPixelLabRenders(20),
        getPixelLabCache(40)
      ]);
      setRenders(renderResponse.renders);
      setCache(cacheResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PixelLab data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScreenScraper = useCallback(async () => {
    try {
      const [status, settings] = await Promise.all([
        getScreenScraperStatus(),
        getScreenScraperSettings()
      ]);
      setScreenScraperStatus(status);
      setScreenScraperSettings(settings);
      setScreenScraperError(null);
    } catch (err) {
      setScreenScraperError(
        err instanceof Error ? err.message : "Unable to load ScreenScraper diagnostics"
      );
    }
  }, []);

  useEffect(() => {
    void loadData();
    void loadScreenScraper();
  }, [loadData, loadScreenScraper]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState.romId || !formState.prompt) {
        setFormState((state) => ({
          ...state,
          message: "ROM ID and prompt are required."
        }));
        return;
      }

      setFormState((state) => ({ ...state, submitting: true, message: "" }));
      try {
        await requestPixelLabRender({
          romId: formState.romId.trim(),
          prompt: formState.prompt.trim(),
          styleId: formState.styleId.trim() || undefined
        });
        setFormState((state) => ({
          ...state,
          submitting: false,
          message: "PixelLab render enqueued. Refreshing metrics…"
        }));
        await loadData();
      } catch (err) {
        setFormState((state) => ({
          ...state,
          submitting: false,
          message: err instanceof Error ? err.message : "Failed to request PixelLab render"
        }));
      }
    },
    [formState.prompt, formState.romId, formState.styleId, loadData]
  );

  const handleRegenerate = useCallback(
    async (cacheKey: string) => {
      setRegeneratingKey(cacheKey);
      try {
        await regeneratePixelLabRender(cacheKey);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to regenerate render");
      } finally {
        setRegeneratingKey(null);
      }
    },
    [loadData]
  );

  const hitRatePercent = useMemo(() => {
    if (!cache) {
      return "0%";
    }
    return `${Math.round(cache.summary.hitRate * 100)}%`;
  }, [cache]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-parchment">
      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-[0.4em] text-primary">PixelLab Control Deck</h1>
          <p className="text-sm text-parchment/80">
            Queue hero art renders, monitor cache health, and cross-check ScreenScraper enrichment
            without leaving the cockpit.
          </p>
        </header>

        {loading && <p className="text-sm text-parchment/70">Summoning render spirits…</p>}
        {error && !loading && <p className="text-sm text-red-300">{error}</p>}

        <section aria-labelledby="hero-art-form" className="space-y-4">
          <h2 id="hero-art-form" className="text-lg font-semibold uppercase tracking-widest text-lagoon">
            Request Hero Art
          </h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-left text-xs uppercase tracking-widest text-slate-200">
              Target ROM ID
              <input
                value={formState.romId}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, romId: event.target.value, message: "" }))
                }
                className="rounded border border-lagoon/40 bg-night/70 p-2 text-sm text-parchment"
                placeholder="rom_cuid"
              />
            </label>
            <label className="flex flex-col gap-2 text-left text-xs uppercase tracking-widest text-slate-200">
              Style override (optional)
              <input
                value={formState.styleId}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, styleId: event.target.value, message: "" }))
                }
                className="rounded border border-lagoon/40 bg-night/70 p-2 text-sm text-parchment"
                placeholder="PIXELLAB_STYLE_ID"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-left text-xs uppercase tracking-widest text-slate-200">
              Prompt
              <textarea
                value={formState.prompt}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, prompt: event.target.value, message: "" }))
                }
                rows={4}
                className="rounded border border-lagoon/40 bg-night/70 p-2 text-sm text-parchment"
              />
            </label>
            <div className="md:col-span-2 flex items-center justify-between text-sm text-parchment/80">
              <button
                type="submit"
                disabled={formState.submitting}
                className="rounded border border-primary bg-primary px-4 py-2 font-semibold text-night transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-600"
              >
                {formState.submitting ? "Requesting render…" : "Summon Hero Art"}
              </button>
              {formState.message && <span className="text-xs text-slate-300">{formState.message}</span>}
            </div>
          </form>
        </section>
      </PixelFrame>

      {cache && (
        <PixelFrame className="space-y-4 bg-night/80 p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold uppercase tracking-widest text-lagoon">Cache Pulse</h2>
              <p className="text-xs text-parchment/70">Hit rate {hitRatePercent} across {cache.summary.entries} keys.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center text-xs uppercase tracking-widest text-parchment/70">
              <Metric label="Hits" value={cache.summary.hits} />
              <Metric label="Misses" value={cache.summary.misses} />
              <Metric label="Stale" value={cache.summary.staleEntries} />
              <Metric
                label="Last render"
                value={cache.summary.latestRenderAt ? new Date(cache.summary.latestRenderAt).toLocaleString() : "—"}
              />
            </div>
          </header>
          <CacheTable entries={cache.entries} onRegenerate={handleRegenerate} regeneratingKey={regeneratingKey} />
        </PixelFrame>
      )}

      {renders.length > 0 && (
        <PixelFrame className="space-y-4 bg-night/80 p-6">
          <h2 className="text-lg font-semibold uppercase tracking-widest text-lagoon">Recent Renders</h2>
          <RenderHistory renders={renders} />
        </PixelFrame>
      )}

      <PixelFrame className="space-y-4 bg-night/80 p-6">
        <h2 className="text-lg font-semibold uppercase tracking-widest text-lagoon">ScreenScraper Diagnostics</h2>
        {screenScraperError && (
          <p className="text-sm text-red-300">{screenScraperError}</p>
        )}
        {screenScraperStatus && screenScraperSettings && (
          <ScreenScraperSummary status={screenScraperStatus} settings={screenScraperSettings} />
        )}
      </PixelFrame>
    </main>
  );
}

function CacheTable({
  entries,
  onRegenerate,
  regeneratingKey
}: {
  entries: PixelLabCacheEntrySummary[];
  onRegenerate: (cacheKey: string) => Promise<void>;
  regeneratingKey: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-parchment/70">No cached renders yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs text-parchment/80">
        <thead>
          <tr className="border-b border-lagoon/30 text-[0.65rem] uppercase tracking-[0.3em] text-slate-300">
            <th className="py-2 pr-4">ROM</th>
            <th className="py-2 pr-4">Prompt</th>
            <th className="py-2 pr-4">Hits</th>
            <th className="py-2 pr-4">Misses</th>
            <th className="py-2 pr-4">Expires</th>
            <th className="py-2 pr-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-lagoon/20 text-[0.7rem]">
              <td className="py-2 pr-4 align-top text-primary">
                <div className="flex flex-col">
                  <span className="font-semibold">{entry.romTitle ?? entry.romId ?? "Unassigned"}</span>
                  <span className="text-[0.6rem] text-slate-400">{entry.cacheKey.slice(0, 10)}…</span>
                </div>
              </td>
              <td className="py-2 pr-4 align-top text-parchment/70">
                <span className="line-clamp-3 whitespace-pre-wrap">{entry.prompt}</span>
              </td>
              <td className="py-2 pr-4 align-top">{entry.hitCount}</td>
              <td className="py-2 pr-4 align-top">{entry.missCount}</td>
              <td className="py-2 pr-4 align-top">
                {entry.expiresAt ? new Date(entry.expiresAt).toLocaleString() : "—"}
              </td>
              <td className="py-2 pr-4 align-top">
                <button
                  type="button"
                  onClick={() => onRegenerate(entry.cacheKey)}
                  disabled={regeneratingKey === entry.cacheKey}
                  className="rounded border border-primary/60 px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
                >
                  {regeneratingKey === entry.cacheKey ? "Refreshing…" : "Regenerate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenderHistory({ renders }: { renders: PixelLabRenderSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs text-parchment/80">
        <thead>
          <tr className="border-b border-lagoon/30 text-[0.65rem] uppercase tracking-[0.3em] text-slate-300">
            <th className="py-2 pr-4">Timestamp</th>
            <th className="py-2 pr-4">ROM</th>
            <th className="py-2 pr-4">Prompt</th>
            <th className="py-2 pr-4">Result</th>
          </tr>
        </thead>
        <tbody>
          {renders.map((render) => (
            <tr key={render.id} className="border-b border-lagoon/20 text-[0.7rem]">
              <td className="py-2 pr-4 align-top text-slate-300">
                {new Date(render.createdAt).toLocaleString()}
              </td>
              <td className="py-2 pr-4 align-top text-primary">
                {render.rom?.title ?? render.rom?.id ?? "—"}
              </td>
              <td className="py-2 pr-4 align-top text-parchment/70">
                <span className="line-clamp-2 whitespace-pre-wrap">{render.prompt}</span>
              </td>
              <td className="py-2 pr-4 align-top">
                {render.cacheHit ? (
                  <span className="text-green-300">Cache</span>
                ) : render.errorMessage ? (
                  <span className="text-red-300">{render.errorMessage}</span>
                ) : (
                  <span className="text-primary">Rendered</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScreenScraperSummary({
  status,
  settings
}: {
  status: ScreenScraperStatus;
  settings: ScreenScraperSettingsResponse;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded border border-lagoon/40 bg-night/70 p-4 text-sm text-parchment/80">
        <p className="font-semibold uppercase tracking-widest text-lagoon">
          Status: {status.enabled ? "Enabled" : "Disabled"}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          {Object.entries(status.diagnostics).map(([key, value]) => (
            <li key={key}>
              <span className="uppercase tracking-[0.3em] text-slate-500">{key}:</span> {String(value)}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded border border-lagoon/40 bg-night/70 p-4 text-sm text-parchment/80">
        <p className="font-semibold uppercase tracking-widest text-lagoon">Effective Settings</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] text-slate-300">
          <SettingsList title="Languages" values={settings.effective.languagePriority} />
          <SettingsList title="Regions" values={settings.effective.regionPriority} />
          <SettingsList title="Media" values={settings.effective.mediaTypes} />
          <div>
            <p className="uppercase tracking-[0.3em] text-slate-500">Limits</p>
            <p>Better media only: {settings.effective.onlyBetterMedia ? "Yes" : "No"}</p>
            <p>Max per type: {settings.effective.maxAssetsPerType}</p>
            <p>Prefer parent: {settings.effective.preferParentGames ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="uppercase tracking-[0.3em] text-slate-500">{title}</p>
      <p>{values.length > 0 ? values.join(", ") : "—"}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-lagoon/30 bg-night/70 p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-parchment">{value}</p>
    </div>
  );
}
