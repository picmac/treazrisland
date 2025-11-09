"use client";

import { useCallback, useMemo, useState, type HTMLAttributes } from "react";
import { PixelButton, PixelNotice } from "@/src/components/pixel";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  enqueueScreenScraperEnrichment,
  getScreenScraperSettings,
  getScreenScraperStatus,
  type ScreenScraperSettings,
  type ScreenScraperSettingsResponse,
  type ScreenScraperStatus,
  updateScreenScraperSettings,
} from "@/src/lib/api/admin/screenscraper";
import { ApiError } from "@/src/lib/api/client";

interface ScreenScraperAdminPageClientProps {
  initialStatus: ScreenScraperStatus | null;
  initialSettings: ScreenScraperSettingsResponse | null;
  initialError?: string | null;
}

type FormState = {
  languagePriority: string;
  regionPriority: string;
  mediaTypes: string;
  onlyBetterMedia: boolean;
  maxAssetsPerType: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type AsyncState = {
  state: "idle" | "pending" | "success" | "error";
  message?: string;
};

function resolveSettingsSource(settings: ScreenScraperSettingsResponse | null): ScreenScraperSettings | null {
  if (!settings) {
    return null;
  }
  return settings.user ?? settings.effective ?? settings.defaults;
}

function toFormState(settings: ScreenScraperSettingsResponse | null): FormState {
  const source = resolveSettingsSource(settings);
  return {
    languagePriority: (source?.languagePriority ?? []).join("\n"),
    regionPriority: (source?.regionPriority ?? []).join("\n"),
    mediaTypes: (source?.mediaTypes ?? []).join("\n"),
    onlyBetterMedia: Boolean(source?.onlyBetterMedia ?? false),
    maxAssetsPerType: source?.maxAssetsPerType ? String(source.maxAssetsPerType) : "",
  };
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const { body, message } = error;
    if (body && typeof body === "object" && "message" in body) {
      const payloadMessage = (body as { message?: unknown }).message;
      if (typeof payloadMessage === "string" && payloadMessage.trim().length > 0) {
        return payloadMessage;
      }
    }
    if (message) {
      return message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong.";
}

function sanitizeList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NaN;
  }
  return parsed;
}

function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) {
    return "—";
  }
  return items.join(", ");
}

function formatDiagnosticValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function ScreenScraperAdminPageClient({
  initialStatus,
  initialSettings,
  initialError,
}: ScreenScraperAdminPageClientProps) {
  const [status, setStatus] = useState<ScreenScraperStatus | null>(initialStatus);
  const [settings, setSettings] = useState<ScreenScraperSettingsResponse | null>(initialSettings);
  const [form, setForm] = useState<FormState>(() => toFormState(initialSettings));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saveState, setSaveState] = useState<AsyncState>({ state: "idle" });
  const [refreshState, setRefreshState] = useState<AsyncState>({ state: "idle" });
  const [enrichmentState, setEnrichmentState] = useState<AsyncState>({ state: "idle" });
  const [romId, setRomId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(initialError ?? null);

  const defaults = useMemo(() => settings?.defaults ?? null, [settings]);
  const effective = useMemo(() => settings?.effective ?? null, [settings]);

  const handleFieldChange = useCallback(<T extends keyof FormState>(field: T, value: FormState[T]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => ({ ...previous, [field]: undefined }));
  }, []);

  const validateForm = useCallback((): { payload: Partial<ScreenScraperSettings> | null; errors: FormErrors } => {
    const errors: FormErrors = {};

    const languagePriority = sanitizeList(form.languagePriority);
    const regionPriority = sanitizeList(form.regionPriority);
    const mediaTypes = sanitizeList(form.mediaTypes);

    const maxAssetsParsed = parsePositiveInteger(form.maxAssetsPerType);
    if (maxAssetsParsed !== undefined && Number.isNaN(maxAssetsParsed)) {
      errors.maxAssetsPerType = "Enter a positive integer.";
    }

    const payload: Partial<ScreenScraperSettings> = {
      languagePriority,
      regionPriority,
      mediaTypes,
      onlyBetterMedia: form.onlyBetterMedia,
    };

    if (maxAssetsParsed !== undefined && !Number.isNaN(maxAssetsParsed)) {
      payload.maxAssetsPerType = maxAssetsParsed;
    }

    return { payload: Object.keys(errors).length > 0 ? null : payload, errors };
  }, [form]);

  const refreshFromServer = useCallback(async () => {
    setRefreshState({ state: "pending" });
    try {
      const [nextStatus, nextSettings] = await Promise.all([
        getScreenScraperStatus(),
        getScreenScraperSettings(),
      ]);
      setStatus(nextStatus);
      setSettings(nextSettings);
      setForm(toFormState(nextSettings));
      setFormErrors({});
      setLoadError(null);
      setRefreshState({ state: "success", message: "Latest data loaded." });
    } catch (error) {
      const message = formatApiError(error);
      setRefreshState({ state: "error", message });
      setLoadError(message);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setSaveState({ state: "pending" });
    const { payload, errors } = validateForm();
    setFormErrors(errors);
    if (!payload) {
      setSaveState({ state: "error", message: "Fix the highlighted fields." });
      return;
    }

    try {
      await updateScreenScraperSettings(payload);
      await refreshFromServer();
      setFormErrors({});
      setLoadError(null);
      setSaveState({ state: "success", message: "Preferences updated." });
    } catch (error) {
      setSaveState({ state: "error", message: formatApiError(error) });
    }
  }, [refreshFromServer, validateForm]);

  const handleEnrichment = useCallback(async () => {
    const trimmed = romId.trim();
    if (!trimmed) {
      setEnrichmentState({ state: "error", message: "Enter a ROM identifier." });
      return;
    }

    const { payload, errors } = validateForm();
    setFormErrors(errors);
    if (!payload) {
      setEnrichmentState({ state: "error", message: "Fix the highlighted fields." });
      return;
    }

    setEnrichmentState({ state: "pending" });
    try {
      await enqueueScreenScraperEnrichment(trimmed, payload);
      setEnrichmentState({ state: "success", message: "Enrichment job queued." });
    } catch (error) {
      setEnrichmentState({ state: "error", message: formatApiError(error) });
    }
  }, [romId, validateForm]);

  return (
    <div className="flex flex-col gap-6">
      {loadError ? (
        <PixelNotice tone="error">
          <span className="font-semibold uppercase tracking-[0.3em]">{loadError}</span>
        </PixelNotice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
          <header className="space-y-1">
            <h2 className="text-lg uppercase tracking-[0.4em] text-primary">Service Health</h2>
            <p className="text-xs text-slate-200">
              Check the current heartbeat, rate limit diagnostics, and connection telemetry from ScreenScraper.
            </p>
          </header>

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold uppercase tracking-[0.3em] text-slate-300">Status: </span>
              {status ? (status.enabled ? "Operational" : "Disabled") : "Unknown"}
            </p>
            <dl className="space-y-2">
              {status?.diagnostics && Object.keys(status.diagnostics).length > 0 ? (
                Object.entries(status.diagnostics).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">{key}</dt>
                    <dd className="rounded bg-surface-sunken/80 p-2 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                      {formatDiagnosticValue(value)}
                    </dd>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-300">No diagnostics reported.</p>
              )}
            </dl>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {refreshState.state === "error" && refreshState.message ? (
              <PixelNotice tone="error">{refreshState.message}</PixelNotice>
            ) : null}
            {refreshState.state === "success" && refreshState.message ? (
              <PixelNotice tone="success">{refreshState.message}</PixelNotice>
            ) : null}
            <PixelButton onClick={() => { void refreshFromServer(); }} disabled={refreshState.state === "pending"}>
              {refreshState.state === "pending" ? "Refreshing…" : "Refresh status"}
            </PixelButton>
          </div>
        </PixelFrame>

        <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
          <header className="space-y-1">
            <h2 className="text-lg uppercase tracking-[0.4em] text-primary">Effective Defaults</h2>
            <p className="text-xs text-slate-200">
              The active priority stack after combining system defaults and any overrides.
            </p>
          </header>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Language priority</dt>
              <dd>{formatList(effective?.languagePriority)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Region priority</dt>
              <dd>{formatList(effective?.regionPriority)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Media types</dt>
              <dd>{formatList(effective?.mediaTypes)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Prefer higher quality replacements</dt>
              <dd>{effective?.onlyBetterMedia ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Max assets per type</dt>
              <dd>{typeof effective?.maxAssetsPerType === "number" ? effective.maxAssetsPerType : "—"}</dd>
            </div>
          </dl>

          {defaults ? (
            <details className="rounded border border-primary/30 bg-surface-sunken/60 p-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold uppercase tracking-[0.3em] text-primary">
                View system defaults
              </summary>
              <div className="mt-2 space-y-2">
                <p>
                  <span className="font-semibold">Languages:</span> {formatList(defaults.languagePriority)}
                </p>
                <p>
                  <span className="font-semibold">Regions:</span> {formatList(defaults.regionPriority)}
                </p>
                <p>
                  <span className="font-semibold">Media types:</span> {formatList(defaults.mediaTypes)}
                </p>
                <p>
                  <span className="font-semibold">Only better media:</span> {defaults.onlyBetterMedia ? "Enabled" : "Disabled"}
                </p>
                <p>
                  <span className="font-semibold">Max assets per type:</span> {typeof defaults.maxAssetsPerType === "number" ? defaults.maxAssetsPerType : "—"}
                </p>
              </div>
            </details>
          ) : null}
        </PixelFrame>
      </div>

      <PixelFrame className="space-y-5 bg-night/85 p-6 shadow-pixel">
        <header className="space-y-1">
          <h2 className="text-lg uppercase tracking-[0.4em] text-primary">Preference Overrides</h2>
          <p className="text-xs text-slate-200">
            Adjust how TREAZRISLAND requests art and metadata. Lists are evaluated from top to bottom.
          </p>
        </header>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Textarea
            label="Language priority"
            value={form.languagePriority}
            onChange={(value) => handleFieldChange("languagePriority", value)}
            error={formErrors.languagePriority}
            hint="Enter one language per line."
          />
          <Textarea
            label="Region priority"
            value={form.regionPriority}
            onChange={(value) => handleFieldChange("regionPriority", value)}
            error={formErrors.regionPriority}
            hint="Enter one region slug per line (e.g., eu, us, jp)."
          />
          <Textarea
            label="Media type priority"
            value={form.mediaTypes}
            onChange={(value) => handleFieldChange("mediaTypes", value)}
            error={formErrors.mediaTypes}
            hint="One media type per line (mix, wheel, snap, etc.)."
          />
          <Checkbox
            label="Only replace media when higher quality"
            checked={form.onlyBetterMedia}
            onChange={(checked) => handleFieldChange("onlyBetterMedia", checked)}
          />
          <Field
            label="Max assets per type"
            value={form.maxAssetsPerType}
            onChange={(value) => handleFieldChange("maxAssetsPerType", value)}
            error={formErrors.maxAssetsPerType}
            inputMode="numeric"
            hint="Leave blank to inherit server defaults."
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {saveState.state === "error" && saveState.message ? (
              <PixelNotice tone="error">{saveState.message}</PixelNotice>
            ) : null}
            {saveState.state === "success" && saveState.message ? (
              <PixelNotice tone="success">{saveState.message}</PixelNotice>
            ) : null}
            <PixelButton type="submit" disabled={saveState.state === "pending"}>
              {saveState.state === "pending" ? "Saving…" : "Save preferences"}
            </PixelButton>
          </div>
        </form>
      </PixelFrame>

      <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
        <header className="space-y-1">
          <h2 className="text-lg uppercase tracking-[0.4em] text-primary">On-demand Enrichment</h2>
          <p className="text-xs text-slate-200">
            Kick off a ScreenScraper enrichment job for a single ROM using the currently configured overrides.
          </p>
        </header>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleEnrichment();
          }}
        >
          <Field
            label="ROM identifier"
            value={romId}
            onChange={setRomId}
            hint="Use the internal ROM UUID from the library."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {enrichmentState.state === "error" && enrichmentState.message ? (
              <PixelNotice tone="error">{enrichmentState.message}</PixelNotice>
            ) : null}
            {enrichmentState.state === "success" && enrichmentState.message ? (
              <PixelNotice tone="success">{enrichmentState.message}</PixelNotice>
            ) : null}
            <PixelButton type="submit" disabled={enrichmentState.state === "pending"}>
              {enrichmentState.state === "pending" ? "Queuing…" : "Queue enrichment"}
            </PixelButton>
          </div>
        </form>
      </PixelFrame>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
};

function Field({ label, value, onChange, hint, error, type = "text", inputMode }: FieldProps) {
  return (
    <div className="space-y-1 text-sm">
      <label className="block text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
        <input
          className="mt-1 w-full rounded-pixel border border-ink/40 bg-surface-sunken px-3 py-2 text-sm text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-night"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          inputMode={inputMode}
          aria-invalid={error ? "true" : undefined}
        />
      </label>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
};

function Textarea({ label, value, onChange, hint, error }: TextareaProps) {
  return (
    <div className="space-y-1 text-sm">
      <label className="block text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
        <textarea
          className="mt-1 w-full rounded-pixel border border-ink/40 bg-surface-sunken px-3 py-2 text-sm text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-night"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          aria-invalid={error ? "true" : undefined}
        />
      </label>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border border-ink/40 bg-surface-sunken text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-xs uppercase tracking-[0.3em]">{label}</span>
    </label>
  );
}
