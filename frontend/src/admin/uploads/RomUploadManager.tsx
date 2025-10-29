"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { listAdminPlatforms, type AdminPlatform } from "@lib/api/admin/platforms";
import {
  uploadAdminArchive,
  type UploadMetadata,
  type UploadResponse,
  type UploadDuplicateResult,
  type UploadSuccessResult
} from "@lib/api/admin/uploads";

type UploadStatus = "pending" | "uploading" | "success" | "duplicate" | "error";

type UploadItem = {
  id: string;
  file: File;
  type: "rom" | "bios";
  platformSlug: string | null;
  romTitle: string;
  biosCore: string;
  biosRegion: string;
  status: UploadStatus;
  message?: string;
  result?: UploadSuccessResult | UploadDuplicateResult;
};

const MAX_SIZE_BYTES = 1024 * 1024 * 1024;

type RecentRom = {
  id: string;
  title: string;
  platformSlug: string | null;
};

export function RomUploadManager() {
  const [platforms, setPlatforms] = useState<AdminPlatform[]>([]);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recentRoms, setRecentRoms] = useState<RecentRom[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlatforms() {
      try {
        const response = await listAdminPlatforms();
        if (!cancelled) {
          setPlatforms(response.platforms);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load platforms";
          setPlatformError(message);
        }
      }
    }

    fetchPlatforms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (platforms.length === 0) {
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (item.type === "rom" && !item.platformSlug) {
          return { ...item, platformSlug: platforms[0]?.slug ?? null };
        }
        return item;
      })
    );
  }, [platforms]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) {
        return;
      }

      setGlobalError(null);
      setItems((previous) => {
        const next = [...previous];
        for (const file of list) {
          if (file.size > MAX_SIZE_BYTES) {
            setGlobalError(
              `File ${file.name} exceeds the 1 GiB limit and was skipped.`
            );
            continue;
          }

          const id = crypto.randomUUID();
          const defaultPlatform = platforms[0]?.slug ?? null;
          next.push({
            id,
            file,
            type: "rom",
            platformSlug: defaultPlatform,
            romTitle: deriveRomTitle(file.name),
            biosCore: "",
            biosRegion: "",
            status: "pending"
          });
        }
        return next;
      });
    },
    [platforms]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer?.files) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  }, []);

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) {
        return;
      }
      handleFiles(event.target.files);
      event.target.value = "";
    },
    [handleFiles]
  );

  const handleItemChange = useCallback(
    (id: string, updater: (item: UploadItem) => UploadItem) => {
      setItems((current) => current.map((item) => (item.id === id ? updater(item) : item)));
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    let success = 0;
    let duplicate = 0;
    let error = 0;
    for (const item of items) {
      if (item.status === "success") success += 1;
      else if (item.status === "duplicate") duplicate += 1;
      else if (item.status === "error") error += 1;
    }
    return { total, success, duplicate, error };
  }, [items]);

  const handleUpload = useCallback(async () => {
    if (items.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setGlobalError(null);

    for (const item of items) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: "uploading", message: undefined }
            : candidate
        )
      );

      try {
        const metadata: UploadMetadata =
          item.type === "rom"
            ? {
                clientId: item.id,
                type: "rom",
                originalFilename: item.file.name,
                platformSlug: item.platformSlug ?? "",
                romTitle: item.romTitle.trim() || undefined
              }
            : {
                clientId: item.id,
                type: "bios",
                originalFilename: item.file.name,
                biosCore: item.biosCore.trim(),
                biosRegion: item.biosRegion.trim() || undefined
              };

        if (metadata.type === "rom" && metadata.platformSlug.length === 0) {
          throw new Error("Please choose a platform before uploading this ROM.");
        }

        if (metadata.type === "bios" && metadata.biosCore.length === 0) {
          throw new Error("BIOS uploads require a core identifier.");
        }

        const response: UploadResponse = await uploadAdminArchive(metadata, item.file);
        const { result } = response;

        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  status: result.status,
                  result,
                  message:
                    result.status === "success"
                      ? "Upload completed"
                      : result.reason ?? "Duplicate archive"
                }
              : candidate
          )
        );

        if (result.romId && (result.status === "success" || result.status === "duplicate")) {
          const romTitle =
            result.romTitle ??
            (metadata.type === "rom"
              ? metadata.romTitle ?? metadata.originalFilename
              : metadata.originalFilename);
          const platformSlug =
            result.platformSlug ?? (metadata.type === "rom" ? metadata.platformSlug ?? null : null);
          setRecentRoms((current) => {
            const next: RecentRom = {
              id: result.romId as string,
              title: romTitle,
              platformSlug
            };
            const deduped = current.filter((rom) => rom.id !== next.id);
            return [next, ...deduped].slice(0, 8);
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: "error", message }
              : candidate
          )
        );
      }
    }

    setIsUploading(false);
  }, [isUploading, items]);

  const handleClearCompleted = useCallback(() => {
    setItems((current) => current.filter((item) => item.status === "pending"));
  }, []);

  return (
    <div className="space-y-6">
      <div
        className={clsx(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition",
          dragActive ? "border-primary bg-primary/10" : "border-primary/40"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <p className="text-center text-sm uppercase tracking-widest text-slate-200">
          Drop ROM or BIOS archives here, or click to browse
        </p>
        <p className="text-xs text-slate-400">Supported formats: zip, 7z, chd, bin, iso (≤ 1 GiB)</p>
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.7z,.rar,.chd,.bin,.iso"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {globalError && <p className="text-sm text-red-300">{globalError}</p>}
      {platformError && <p className="text-sm text-red-300">{platformError}</p>}

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <p>
              Queue: {stats.total} files • {stats.success} uploaded • {stats.duplicate} duplicates •
              {" "}
              {stats.error} errors
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className={clsx(
                  "rounded px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                  isUploading
                    ? "bg-slate-500 text-slate-900"
                    : "bg-primary text-slate-900 shadow hover:bg-primary/80"
                )}
              >
                {isUploading ? "Uploading…" : "Start Upload"}
              </button>
              <button
                type="button"
                onClick={handleClearCompleted}
                className="rounded border border-slate-500 px-3 py-2 text-xs uppercase tracking-wide text-slate-200 hover:bg-slate-700"
              >
                Clear Completed
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                platforms={platforms}
                onChange={handleItemChange}
                onRemove={handleRemove}
                disabled={isUploading && item.status === "uploading"}
              />
            ))}
          </div>
        </div>
      )}

      {recentRoms.length > 0 && (
        <div className="space-y-2 rounded border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
          <h3 className="text-xs uppercase tracking-widest text-primary/80">Recently ingested ROMs</h3>
          <ul className="space-y-2">
            {recentRoms.map((rom) => (
              <li key={rom.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/roms/${rom.id}`} className="text-primary hover:underline">
                    {rom.title}
                  </Link>
                  {rom.platformSlug && (
                    <span className="ml-2 text-xs uppercase tracking-widest text-slate-400">
                      ({rom.platformSlug})
                    </span>
                  )}
                </div>
                {rom.platformSlug ? (
                  <Link
                    href={`/platforms/${rom.platformSlug}`}
                    className="text-xs uppercase tracking-widest text-slate-300 hover:text-primary"
                  >
                    View platform
                  </Link>
                ) : (
                  <span className="text-xs uppercase tracking-widest text-slate-500">
                    Platform pending
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type UploadRowProps = {
  item: UploadItem;
  platforms: AdminPlatform[];
  onChange: (id: string, updater: (item: UploadItem) => UploadItem) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
};

function UploadRow({ item, platforms, onChange, onRemove, disabled }: UploadRowProps) {
  const statusClass = getStatusClass(item.status);

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-primary">{item.file.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(item.file.size)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={clsx("rounded px-2 py-1", statusClass)}>{formatStatus(item.status)}</span>
          {item.message && <span className="text-slate-300">{item.message}</span>}
          <button
            type="button"
            className="rounded border border-red-500 px-2 py-1 text-xs uppercase tracking-wide text-red-200 hover:bg-red-500/20"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Upload Type</label>
          <select
            value={item.type}
            onChange={(event) =>
              onChange(item.id, (current) => ({
                ...current,
                type: event.target.value as UploadItem["type"],
                status: current.status === "pending" ? "pending" : current.status
              }))
            }
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            disabled={disabled}
          >
            <option value="rom">ROM</option>
            <option value="bios">BIOS</option>
          </select>
        </div>

        {item.type === "rom" ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Platform</label>
            <select
              value={item.platformSlug ?? ""}
              onChange={(event) =>
                onChange(item.id, (current) => ({
                  ...current,
                  platformSlug: event.target.value,
                  status: current.status === "pending" ? "pending" : current.status
                }))
              }
              className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              disabled={disabled || platforms.length === 0}
            >
              <option value="">Select platform…</option>
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.slug}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">BIOS Core</label>
            <input
              type="text"
              value={item.biosCore}
              onChange={(event) =>
                onChange(item.id, (current) => ({
                  ...current,
                  biosCore: event.target.value,
                  status: current.status === "pending" ? "pending" : current.status
                }))
              }
              placeholder="pcsx-rearmed"
              className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              disabled={disabled}
            />
          </div>
        )}

        {item.type === "rom" ? (
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Display Title</label>
            <input
              type="text"
              value={item.romTitle}
              onChange={(event) =>
                onChange(item.id, (current) => ({
                  ...current,
                  romTitle: event.target.value,
                  status: current.status === "pending" ? "pending" : current.status
                }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              disabled={disabled}
            />
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">BIOS Region (optional)</label>
            <input
              type="text"
              value={item.biosRegion}
              onChange={(event) =>
                onChange(item.id, (current) => ({
                  ...current,
                  biosRegion: event.target.value,
                  status: current.status === "pending" ? "pending" : current.status
                }))
              }
              placeholder="us, jp, eu"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              disabled={disabled}
            />
          </div>
        )}

        {item.result && (
          <div className="md:col-span-2 text-xs text-slate-300">
            <p>Audit ID: {item.result.uploadAuditId}</p>
            {item.result.status === "success" && (
              <p>
                Storage Key: <span className="text-primary">{item.result.storageKey}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatStatus(status: UploadStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "uploading":
      return "Uploading";
    case "success":
      return "Uploaded";
    case "duplicate":
      return "Duplicate";
    case "error":
      return "Error";
    default:
      return status;
  }
}

function getStatusClass(status: UploadStatus): string {
  switch (status) {
    case "pending":
      return "bg-slate-700 text-slate-200";
    case "uploading":
      return "bg-blue-600/30 text-blue-200";
    case "success":
      return "bg-emerald-700/30 text-emerald-200";
    case "duplicate":
      return "bg-amber-700/30 text-amber-200";
    case "error":
      return "bg-red-700/30 text-red-200";
    default:
      return "bg-slate-700 text-slate-200";
  }
}

function deriveRomTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}
