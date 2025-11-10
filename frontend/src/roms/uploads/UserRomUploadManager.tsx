"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import { listPlatforms } from "@lib/api/library";
import { uploadRomArchive, type RomUploadMetadata } from "@lib/api/uploads";
import { UploadQueue } from "@/src/uploads/UploadQueue";
import { MAX_UPLOAD_SIZE_BYTES } from "@/src/uploads/constants";
import type { UploadItem, UploadPlatform, UploadQueueStats } from "@/src/uploads/types";
import { deriveRomTitle } from "@/src/uploads/utils";

export function UserRomUploadManager() {
  const [platforms, setPlatforms] = useState<UploadPlatform[]>([]);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlatforms() {
      try {
        const response = await listPlatforms({ includeEmpty: true });
        if (!cancelled) {
          setPlatforms(
            response.platforms.map((platform) => ({
              id: platform.id,
              name: platform.name,
              slug: platform.slug
            }))
          );
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
          if (file.size > MAX_UPLOAD_SIZE_BYTES) {
            setGlobalError(`File ${file.name} exceeds the 1 GiB limit and was skipped.`);
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

  const stats = useMemo<UploadQueueStats>(() => {
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
        if (!item.platformSlug) {
          throw new Error("Please choose a platform before uploading this ROM.");
        }

        const metadata: RomUploadMetadata = {
          clientId: item.id,
          type: "rom",
          originalFilename: item.file.name,
          platformSlug: item.platformSlug,
          romTitle: item.romTitle.trim() || undefined
        };

        const response = await uploadRomArchive(metadata, item.file);
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
          Drop ROM archives here, or click to browse
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
              Queue: {stats.total} files • {stats.success} uploaded • {stats.duplicate} duplicates • {stats.error} errors
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

          <UploadQueue
            items={items}
            platforms={platforms}
            onChange={handleItemChange}
            onRemove={handleRemove}
            disabled={isUploading}
            allowBios={false}
          />
        </div>
      )}
    </div>
  );
}
