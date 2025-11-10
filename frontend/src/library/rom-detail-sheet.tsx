"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { getRom, type RomDetail } from "@lib/api/roms";
import { PixelButton, PixelFrame } from "@/src/components/pixel";
import { useSession } from "@/src/auth/session-provider";
import { enqueueScreenScraperEnrichment } from "@/src/lib/api/admin/screenscraper";

type RomDetailSheetProps = {
  id: string;
};

type FetchState = "idle" | "loading" | "loaded" | "error";

export function RomDetailSheet({ id }: RomDetailSheetProps) {
  const [state, setState] = useState<FetchState>("idle");
  const [rom, setRom] = useState<RomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const [enrichmentStatus, setEnrichmentStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [enrichmentMessage, setEnrichmentMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRom() {
      setState("loading");
      setError(null);
      try {
        const detail = await getRom(id, isAdmin ? { includeHistory: true } : {});
        if (!cancelled) {
          setRom(detail);
          setState("loaded");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ROM details");
          setState("error");
        }
      }
    }

    void loadRom();
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin]);

  const metadata = rom?.metadata ?? [];
  const primary = metadata[0] ?? null;
  const enrichmentJobs = rom?.enrichmentJobs ?? [];
  const uploadAudits = rom?.uploadAudits ?? [];


  const handleEnrichment = async () => {
    if (!rom) {
      return;
    }

    setEnrichmentStatus("loading");
    setEnrichmentMessage(null);
    try {
      await enqueueScreenScraperEnrichment(rom.id);
      setEnrichmentStatus("success");
      setEnrichmentMessage("ScreenScraper enrichment queued.");
    } catch (err) {
      setEnrichmentStatus("error");
      setEnrichmentMessage(
        err instanceof Error ? err.message : "Failed to enqueue ScreenScraper job"
      );
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 text-foreground">
      <PixelFrame className="space-y-4 p-6" tone="raised">
        {state === "loading" && <p className="text-sm text-foreground/80">Charting ROM manifest…</p>}
        {state === "error" && error && (
          <p className="text-sm text-[color:var(--color-danger)]">{error}</p>
        )}
        {state === "loaded" && rom && (
          <div className="space-y-4">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-primary/70">ROM Detail</p>
              <h1 className="text-3xl font-bold text-foreground">{rom.title}</h1>
              <div className="text-sm text-foreground/70">
                <span className="mr-4">Platform: {rom.platform.name}</span>
                <span className="mr-4">Year: {rom.releaseYear ?? "????"}</span>
                <span>Players: {rom.players ?? "?"}</span>
              </div>
              {isAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em]">
                  <PixelButton
                    type="button"
                    onClick={handleEnrichment}
                    disabled={enrichmentStatus === "loading"}
                    size="sm"
                    variant={enrichmentStatus === "success" ? "secondary" : "ghost"}
                  >
                    {enrichmentStatus === "loading" ? "Queueing…" : "Queue ScreenScraper job"}
                  </PixelButton>
                  {enrichmentMessage && (
                    <span
                      className={
                        enrichmentStatus === "error"
                          ? "text-[color:var(--color-danger)]"
                          : "text-foreground/70"
                      }
                    >
                      {enrichmentMessage}
                    </span>
                  )}
                </div>
              )}
            </header>

            {primary?.summary && (
              <section className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Synopsis</h2>
                <p className="text-sm leading-relaxed text-foreground/80">{primary.summary}</p>
              </section>
            )}

            <section className="space-y-2 text-sm text-foreground/70">
              <h2 className="text-lg font-semibold text-foreground">Metadata</h2>
              <ul className="space-y-1">
                {primary?.developer && <li>Developer: {primary.developer}</li>}
                {primary?.publisher && <li>Publisher: {primary.publisher}</li>}
                {primary?.genre && <li>Genre: {primary.genre}</li>}
                {primary?.rating && <li>Rating: {primary.rating.toFixed(1)}</li>}
                <li>ROM Size: {rom.romSize ? formatBytes(rom.romSize) : "Unknown"}</li>
                <li>SHA-256: {rom.binary?.checksumSha256 ?? "N/A"}</li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-foreground/70">
              <h2 className="text-lg font-semibold text-foreground">Assets</h2>
              {rom.assets.length === 0 ? (
                <p>No stored assets yet.</p>
              ) : (
                <ul className="space-y-1">
                  {rom.assets.map((asset) => (
                    <li key={asset.id} className="flex items-center justify-between gap-4">
                      <span>
                        {`${asset.type} • ${asset.source}`}
                        {asset.language ? ` • ${asset.language}` : ""}
                        {asset.region ? ` • ${asset.region}` : ""}
                      </span>
                      <span className="text-xs text-foreground/50">
                        {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {isAdmin && (
              <Fragment>
                <CollapsibleSection title="Metadata timeline" defaultOpen>
                  {metadata.length === 0 ? (
                    <p className="text-sm text-foreground/60">No metadata history recorded.</p>
                  ) : (
                    <ol className="space-y-3">
                      {metadata.map((entry) => (
                        <li
                          key={`${entry.id}-${entry.createdAt}`}
                          className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50">
                            <span>{entry.source ?? "Unknown source"}</span>
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                          <div className="space-y-1 text-sm text-foreground/80">
                            {entry.summary && <p>{entry.summary}</p>}
                            <dl className="grid gap-x-4 gap-y-1 text-xs uppercase tracking-[0.25em] text-foreground/50 sm:grid-cols-2">
                              {entry.language && (
                                <DescriptionRow label="Language" value={entry.language} />
                              )}
                              {entry.region && <DescriptionRow label="Region" value={entry.region} />}
                              {entry.developer && (
                                <DescriptionRow label="Developer" value={entry.developer} />
                              )}
                              {entry.publisher && (
                                <DescriptionRow label="Publisher" value={entry.publisher} />
                              )}
                              {entry.genre && <DescriptionRow label="Genre" value={entry.genre} />}
                              {typeof entry.rating === "number" && (
                                <DescriptionRow label="Rating" value={entry.rating.toFixed(1)} />
                              )}
                            </dl>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title="Enrichment jobs" defaultOpen>
                  {enrichmentJobs.length === 0 ? (
                    <p className="text-sm text-foreground/60">No enrichment jobs run yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {enrichmentJobs.map((job) => (
                        <li
                          key={job.id}
                          className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50">
                            <span>{job.provider}</span>
                            <span>
                              Queued {formatDateTime(job.createdAt)}
                              {job.updatedAt && job.updatedAt !== job.createdAt
                                ? ` • Updated ${formatDateTime(job.updatedAt)}`
                                : ""}
                            </span>
                          </div>
                          <dl className="grid gap-x-4 gap-y-1 text-xs uppercase tracking-[0.25em] text-foreground/50 sm:grid-cols-2">
                            <DescriptionRow label="Status" value={job.status} />
                            {job.providerRomId && (
                              <DescriptionRow label="Remote ID" value={job.providerRomId} />
                            )}
                          </dl>
                          {job.errorMessage && (
                            <p className="text-sm text-[color:var(--color-danger)]">{job.errorMessage}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title="Upload audit log" defaultOpen>
                  {uploadAudits.length === 0 ? (
                    <p className="text-sm text-foreground/60">No upload activity recorded.</p>
                  ) : (
                    <ul className="space-y-3">
                      {uploadAudits.map((audit) => (
                        <li
                          key={audit.id}
                          className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50">
                            <span>{audit.status}</span>
                            <span>{formatDateTime(audit.createdAt)}</span>
                          </div>
                          <dl className="grid gap-x-4 gap-y-1 text-xs uppercase tracking-[0.25em] text-foreground/50 sm:grid-cols-2">
                            <DescriptionRow label="Kind" value={audit.kind} />
                            <DescriptionRow
                              label="Filename"
                              value={audit.originalFilename ?? "Unknown"}
                            />
                            <DescriptionRow
                              label="Storage key"
                              value={audit.storageKey ?? "Not persisted"}
                            />
                            <DescriptionRow
                              label="Archive type"
                              value={audit.archiveMimeType ?? "Unknown"}
                            />
                            <DescriptionRow
                              label="Archive size"
                              value={
                                typeof audit.archiveSize === "number"
                                  ? formatBytes(audit.archiveSize)
                                  : "Unknown"
                              }
                            />
                            <DescriptionRow
                              label="SHA-256"
                              value={audit.checksumSha256 ?? "N/A"}
                            />
                            {audit.checksumSha1 && (
                              <DescriptionRow label="SHA-1" value={audit.checksumSha1} />
                            )}
                            {audit.checksumMd5 && (
                              <DescriptionRow label="MD5" value={audit.checksumMd5} />
                            )}
                            {audit.checksumCrc32 && (
                              <DescriptionRow label="CRC32" value={audit.checksumCrc32} />
                            )}
                          </dl>
                          {audit.errorMessage && (
                            <p className="text-sm text-[color:var(--color-danger)]">{audit.errorMessage}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>
              </Fragment>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-foreground/60">
              <Link href={`/platforms/${rom.platform.slug}`} className="text-primary hover:underline">
                Back to {rom.platform.shortName ?? rom.platform.name}
              </Link>
            </div>
          </div>
        )}
      </PixelFrame>
    </main>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function DescriptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-foreground/80">{value}</span>
    </div>
  );
}

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  return (
    <details
      className="rounded-lg border border-foreground/15 bg-foreground/[0.04] p-4 text-foreground"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-foreground/70">
        {title}
        <span className="text-xs font-normal tracking-[0.3em] text-foreground/40">Toggle</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm text-foreground/80">{children}</div>
    </details>
  );
}
