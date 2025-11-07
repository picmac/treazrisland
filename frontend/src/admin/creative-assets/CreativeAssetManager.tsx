"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignCreativeAssetUsage,
  createCreativeAsset,
  deleteCreativeAsset,
  listCreativeAssets,
  removeCreativeAssetUsage,
  replaceCreativeAssetFile,
  updateCreativeAsset,
  type CreativeAsset,
  type CreativeAssetKind,
  type CreativeAssetStatus,
  type CreativeAssetUsageKind
} from "@lib/api/admin/creative-assets";
import { listAdminPlatforms, type AdminPlatform } from "@lib/api/admin/platforms";
import { resolveAssetUrl } from "@lib/media";

const DEFAULT_KIND: CreativeAssetKind = "HERO";
const DEFAULT_STATUS: CreativeAssetStatus = "ACTIVE";

const KIND_LABELS: Record<CreativeAssetKind, string> = {
  HERO: "Hero",
  BACKGROUND: "Background",
  BANNER: "Banner"
};

const STATUS_LABELS: Record<CreativeAssetStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived"
};

type UsageDraft = {
  platformSlug: string;
  notes: string;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;

type PlatformOptions = {
  value: string;
  label: string;
};

export function CreativeAssetManager() {
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [platforms, setPlatforms] = useState<AdminPlatform[]>([]);
  const [usageDrafts, setUsageDrafts] = useState<Record<string, UsageDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CreativeAssetKind>(DEFAULT_KIND);
  const [status] = useState<CreativeAssetStatus>(DEFAULT_STATUS);
  const [assignLibraryHero, setAssignLibraryHero] = useState(false);
  const [initialPlatformSlug, setInitialPlatformSlug] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [initialWidth, setInitialWidth] = useState("");
  const [initialHeight, setInitialHeight] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyAssets, setBusyAssets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      setError(null);
      try {
        const response = await listCreativeAssets();
        if (!cancelled) {
          setAssets(response.assets);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load creative assets");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatforms() {
      try {
        const response = await listAdminPlatforms();
        if (!cancelled) {
          setPlatforms(response.platforms);
          if (response.platforms.length > 0) {
            setInitialPlatformSlug((current) => current || response.platforms[0].slug);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setPlatformError(err instanceof Error ? err.message : "Unable to load platforms");
        }
      }
    }

    loadPlatforms();
    return () => {
      cancelled = true;
    };
  }, []);

  const platformOptions: PlatformOptions[] = useMemo(
    () =>
      platforms.map((platform) => ({
        value: platform.slug,
        label: `${platform.shortName ?? platform.slug.toUpperCase()} — ${platform.name}`
      })),
    [platforms]
  );

  const setAssetBusy = useCallback((assetId: string, busy: boolean) => {
    setBusyAssets((current) => ({ ...current, [assetId]: busy }));
  }, []);

  const updateAssetInState = useCallback((next: CreativeAsset) => {
    setAssets((current) =>
      current.map((asset) => (asset.id === next.id ? next : asset))
    );
  }, []);

  const handleCreateAsset = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setFeedback(null);

      const file = fileInputRef.current?.files?.[0] ?? null;
      if (!file) {
        setFormError("Select an image or artwork file to upload.");
        return;
      }

      const trimmedSlug = slug.trim();
      const trimmedTitle = title.trim();
      if (!trimmedSlug || !trimmedTitle) {
        setFormError("Slug and title are required.");
        return;
      }

      const metadata = {
        slug: trimmedSlug,
        title: trimmedTitle,
        description: description.trim() || undefined,
        kind,
        status,
        width: initialWidth.trim().length > 0 ? Number(initialWidth) : undefined,
        height: initialHeight.trim().length > 0 ? Number(initialHeight) : undefined,
        usages: [] as Array<{ kind: CreativeAssetUsageKind; platformSlug?: string; notes?: string }>
      };

      if (Number.isNaN(metadata.width)) {
        setFormError("Width must be a valid number.");
        return;
      }
      if (Number.isNaN(metadata.height)) {
        setFormError("Height must be a valid number.");
        return;
      }

      if (assignLibraryHero) {
        metadata.usages.push({ kind: "LIBRARY_HERO" });
      }

      const normalizedPlatform = initialPlatformSlug.trim();
      if (normalizedPlatform.length > 0) {
        metadata.usages.push({
          kind: "PLATFORM_HERO",
          platformSlug: normalizedPlatform,
          notes: initialNotes.trim() || undefined
        });
      }

      setSubmitting(true);
      try {
        const response = await createCreativeAsset(metadata, file);
        setAssets((current) => [response.asset, ...current]);
        setSlug("");
        setTitle("");
        setDescription("");
        setKind(DEFAULT_KIND);
        setAssignLibraryHero(false);
        setInitialNotes("");
        setInitialWidth("");
        setInitialHeight("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setFeedback({ type: "success", message: "Creative asset uploaded successfully." });
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to upload creative asset.");
      } finally {
        setSubmitting(false);
      }
    },
    [assignLibraryHero, description, initialHeight, initialNotes, initialPlatformSlug, initialWidth, kind, slug, status, title]
  );

  const handleAssignUsage = useCallback(
    async (asset: CreativeAsset, kind: CreativeAssetUsageKind) => {
      setAssetBusy(asset.id, true);
      setFeedback(null);
      try {
        let usageInput: { kind: CreativeAssetUsageKind; platformSlug?: string; notes?: string };
        if (kind === "LIBRARY_HERO") {
          usageInput = { kind };
        } else {
          const draft = usageDrafts[asset.id] ?? { platformSlug: platforms[0]?.slug ?? "", notes: "" };
          const slugCandidate = draft.platformSlug.trim();
          if (!slugCandidate) {
            setFeedback({ type: "error", message: "Select a platform before assigning hero art." });
            return;
          }
          usageInput = { kind, platformSlug: slugCandidate, notes: draft.notes.trim() || undefined };
        }

        const response = await assignCreativeAssetUsage(asset.id, usageInput);
        updateAssetInState(response.asset);
        setFeedback({ type: "success", message: "Usage assignment saved." });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to assign usage." });
      } finally {
        setAssetBusy(asset.id, false);
      }
    },
    [platforms, setAssetBusy, updateAssetInState, usageDrafts]
  );

  const handleRemoveUsage = useCallback(
    async (assetId: string, usageId: string) => {
      setAssetBusy(assetId, true);
      setFeedback(null);
      try {
        const response = await removeCreativeAssetUsage(assetId, usageId);
        updateAssetInState(response.asset);
        setFeedback({ type: "success", message: "Usage removed." });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Unable to remove usage." });
      } finally {
        setAssetBusy(assetId, false);
      }
    },
    [setAssetBusy, updateAssetInState]
  );

  const handleToggleStatus = useCallback(
    async (asset: CreativeAsset) => {
      const nextStatus: CreativeAssetStatus = asset.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      setAssetBusy(asset.id, true);
      setFeedback(null);
      try {
        const response = await updateCreativeAsset(asset.id, { status: nextStatus });
        updateAssetInState(response.asset);
        setFeedback({ type: "success", message: `Asset marked as ${STATUS_LABELS[nextStatus].toLowerCase()}.` });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Unable to update asset status." });
      } finally {
        setAssetBusy(asset.id, false);
      }
    },
    [setAssetBusy, updateAssetInState]
  );

  const handleDeleteAsset = useCallback(
    async (asset: CreativeAsset) => {
      const confirmed = window.confirm(`Delete curated asset “${asset.title}”? This cannot be undone.`);
      if (!confirmed) {
        return;
      }
      setAssetBusy(asset.id, true);
      setFeedback(null);
      try {
        await deleteCreativeAsset(asset.id);
        setAssets((current) => current.filter((entry) => entry.id !== asset.id));
        setFeedback({ type: "success", message: "Creative asset deleted." });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Unable to delete creative asset." });
      } finally {
        setAssetBusy(asset.id, false);
      }
    },
    [setAssetBusy]
  );

  const handleReplaceFile = useCallback(
    async (assetId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setAssetBusy(assetId, true);
      setFeedback(null);
      try {
        const response = await replaceCreativeAssetFile(assetId, file, {});
        updateAssetInState(response.asset);
        setFeedback({ type: "success", message: "Artwork replaced." });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Unable to replace artwork." });
      } finally {
        setAssetBusy(assetId, false);
        event.target.value = "";
      }
    },
    [setAssetBusy, updateAssetInState]
  );

  const handleUsageDraftChange = useCallback(
    (assetId: string, draft: Partial<UsageDraft>) => {
      setUsageDrafts((current) => ({
        ...current,
        [assetId]: {
          platformSlug: draft.platformSlug ?? current[assetId]?.platformSlug ?? platforms[0]?.slug ?? "",
          notes: draft.notes ?? current[assetId]?.notes ?? ""
        }
      }));
    },
    [platforms]
  );

  const libraryHeroUsage = useCallback(
    (asset: CreativeAsset) => asset.usages.find((usage) => usage.kind === "LIBRARY_HERO"),
    []
  );

  const platformHeroUsages = useCallback(
    (asset: CreativeAsset) => asset.usages.filter((usage) => usage.kind === "PLATFORM_HERO"),
    []
  );

  return (
    <div className="space-y-8">
      <section className="rounded-pixel border border-ink/40 bg-night/80 p-6 text-parchment">
        <h2 className="text-lg font-semibold uppercase tracking-[0.35em] text-lagoon">Upload curated artwork</h2>
        <p className="mt-2 text-sm text-parchment/70">
          Curated hero art overrides platform cards and the library splash. Keep filenames human-friendly—
          they become storage keys for CDN distribution.
        </p>
        {formError ? (
          <p className="mt-3 rounded-pixel border border-red-600/60 bg-red-900/40 p-3 text-sm text-red-200">{formError}</p>
        ) : null}
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreateAsset}>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              placeholder="snes-hero"
              required
            />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              placeholder="Super Nintendo Skyline"
              required
            />
          </label>
          <label className="md:col-span-2 space-y-1 text-xs uppercase tracking-[0.3em]">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              rows={3}
              placeholder="Optional note for other admins"
            />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Kind
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as CreativeAssetKind)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Artwork file
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              required
            />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Width (px)
            <input
              value={initialWidth}
              onChange={(event) => setInitialWidth(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              placeholder="Optional"
              inputMode="numeric"
            />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
            Height (px)
            <input
              value={initialHeight}
              onChange={(event) => setInitialHeight(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
              placeholder="Optional"
              inputMode="numeric"
            />
          </label>
          <div className="md:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-parchment/80">
              <input
                type="checkbox"
                checked={assignLibraryHero}
                onChange={(event) => setAssignLibraryHero(event.target.checked)}
                className="h-4 w-4 rounded border-ink/40 bg-night text-lagoon focus:ring-lagoon"
              />
              Assign as library hero on upload
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
                Platform hero assignment
                <select
                  value={initialPlatformSlug}
                  onChange={(event) => setInitialPlatformSlug(event.target.value)}
                  className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
                >
                  <option value="">Do not assign</option>
                  {platformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-[0.3em]">
                Platform notes
                <input
                  value={initialNotes}
                  onChange={(event) => setInitialNotes(event.target.value)}
                  className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-pixel border border-lagoon bg-lagoon px-4 py-2 text-xs uppercase tracking-[0.35em] text-night transition hover:bg-lagoon/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading…" : "Upload curated asset"}
            </button>
            {platformError ? (
              <span className="text-xs text-red-300">{platformError}</span>
            ) : null}
          </div>
        </form>
      </section>

      {feedback ? (
        <div
          className={`rounded-pixel border px-4 py-3 text-sm ${feedback.type === "success" ? "border-lagoon/70 bg-lagoon/20 text-lagoon" : "border-red-600/60 bg-red-900/30 text-red-200"}`}
        >
          {feedback.message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          Loading curated assets…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-pixel border border-red-600/60 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {!loading && assets.length === 0 && !error ? (
        <div className="rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70">
          No curated assets uploaded yet. Commission some hero art to bring TREAZRISLAND’s library to life.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {assets.map((asset) => {
          const heroUsage = libraryHeroUsage(asset);
          const platformUsages = platformHeroUsages(asset);
          const assetBusy = busyAssets[asset.id] ?? false;
          const draft = usageDrafts[asset.id] ?? {
            platformSlug: platforms[0]?.slug ?? "",
            notes: ""
          };
          const previewUrl = resolveAssetUrl(asset.storageKey, asset.signedUrl);
          const createdAt = new Date(asset.createdAt).toLocaleString();
          const updatedAt = new Date(asset.updatedAt).toLocaleString();

          return (
            <article key={asset.id} className="rounded-pixel border border-ink/40 bg-night/80 p-5 text-parchment">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-lagoon">
                    {asset.title}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.35em] text-parchment/60">
                    {asset.slug} · {KIND_LABELS[asset.kind]} · {STATUS_LABELS[asset.status]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(asset)}
                    disabled={assetBusy}
                    className="rounded-pixel border border-ink/40 bg-night px-3 py-1 text-xs uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {asset.status === "ACTIVE" ? "Archive" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => replaceRefs.current[asset.id]?.click()}
                    disabled={assetBusy}
                    className="rounded-pixel border border-ink/40 bg-night px-3 py-1 text-xs uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Replace art
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(asset)}
                    disabled={assetBusy}
                    className="rounded-pixel border border-red-600/60 bg-red-900/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </header>

              <input
                type="file"
                accept="image/*"
                ref={(element) => {
                  replaceRefs.current[asset.id] = element;
                }}
                className="hidden"
                onChange={(event) => handleReplaceFile(asset.id, event)}
              />

              {asset.description ? (
                <p className="mt-2 text-sm text-parchment/70">{asset.description}</p>
              ) : null}

              {previewUrl ? (
                <div className="mt-4 overflow-hidden rounded-pixel border border-ink/40 bg-night/60">
                  <Image
                    src={previewUrl}
                    alt={`${asset.title} creative asset`}
                    width={asset.width ?? 640}
                    height={asset.height ?? 360}
                    className="h-48 w-full object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-pixel border border-ink/40 bg-night/70 p-4 text-xs text-parchment/60">
                  Asset stored at {asset.storageKey}. Configure NEXT_PUBLIC_MEDIA_CDN for previews.
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-parchment/60">
                <div>
                  <dt>File size</dt>
                  <dd className="text-parchment/80">{Math.round(asset.fileSize / 1024)} KiB</dd>
                </div>
                <div>
                  <dt>Checksum</dt>
                  <dd className="text-parchment/80 truncate">{asset.checksumSha256.slice(0, 16)}…</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd className="text-parchment/80">{createdAt}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd className="text-parchment/80">{updatedAt}</dd>
                </div>
              </dl>

              <section className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-[0.35em] text-lagoon">Library hero</h4>
                  {heroUsage ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveUsage(asset.id, heroUsage.id)}
                      disabled={assetBusy}
                      className="rounded-pixel border border-ink/40 bg-night px-2 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAssignUsage(asset, "LIBRARY_HERO")}
                      disabled={assetBusy}
                      className="rounded-pixel border border-ink/40 bg-night px-2 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Assign
                    </button>
                  )}
                </div>
                {heroUsage ? (
                  <p className="rounded-pixel border border-ink/40 bg-night/70 p-3 text-xs text-parchment/70">
                    Active library hero art{heroUsage.notes ? ` — ${heroUsage.notes}` : ""}
                  </p>
                ) : (
                  <p className="rounded-pixel border border-ink/40 bg-night/60 p-3 text-xs text-parchment/60">
                    No library hero art assigned.
                  </p>
                )}
              </section>

              <section className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs uppercase tracking-[0.35em] text-lagoon">Platform hero slots</h4>
                  <button
                    type="button"
                    onClick={() => handleAssignUsage(asset, "PLATFORM_HERO")}
                    disabled={assetBusy}
                    className="rounded-pixel border border-ink/40 bg-night px-2 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Assign platform
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={draft.platformSlug}
                    onChange={(event) => handleUsageDraftChange(asset.id, { platformSlug: event.target.value })}
                    className="rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
                  >
                    {platformOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={draft.notes}
                    onChange={(event) => handleUsageDraftChange(asset.id, { notes: event.target.value })}
                    className="rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
                    placeholder="Notes (optional)"
                  />
                </div>
                <ul className="space-y-2">
                  {platformUsages.length > 0 ? (
                    platformUsages.map((usage) => (
                      <li
                        key={usage.id}
                        className="flex items-center justify-between rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-xs text-parchment/80"
                      >
                        <span>
                          {usage.platform ? `${usage.platform.shortName ?? usage.platform.slug.toUpperCase()} — ${usage.platform.name}` : usage.targetKey}
                          {usage.notes ? ` · ${usage.notes}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveUsage(asset.id, usage.id)}
                          disabled={assetBusy}
                          className="rounded-pixel border border-ink/40 bg-night px-2 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-parchment transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-pixel border border-ink/40 bg-night/60 px-3 py-2 text-xs text-parchment/60">
                      No platform hero assignments yet.
                    </li>
                  )}
                </ul>
              </section>
            </article>
          );
        })}
      </div>
    </div>
  );
}
