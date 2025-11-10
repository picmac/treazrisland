"use client";

import clsx from "clsx";

import type { UploadItem, UploadPlatform } from "@/src/uploads/types";
import { formatBytes, formatStatus, statusBadgeClass } from "@/src/uploads/utils";

type UploadQueueProps = {
  items: UploadItem[];
  platforms: UploadPlatform[];
  disabled: boolean;
  allowBios: boolean;
  onChange: (id: string, updater: (item: UploadItem) => UploadItem) => void;
  onRemove: (id: string) => void;
};

export function UploadQueue({
  items,
  platforms,
  disabled,
  allowBios,
  onChange,
  onRemove
}: UploadQueueProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <UploadRow
          key={item.id}
          item={item}
          platforms={platforms}
          disabled={disabled && item.status === "uploading"}
          allowBios={allowBios}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

type UploadRowProps = {
  item: UploadItem;
  platforms: UploadPlatform[];
  disabled: boolean;
  allowBios: boolean;
  onChange: (id: string, updater: (item: UploadItem) => UploadItem) => void;
  onRemove: (id: string) => void;
};

function UploadRow({
  item,
  platforms,
  disabled,
  allowBios,
  onChange,
  onRemove
}: UploadRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-primary">{item.file.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(item.file.size)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={statusBadgeClass(item.status)}>{formatStatus(item.status)}</span>
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
        {allowBios && (
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
        )}

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
          <div className={clsx({ "md:col-span-2": allowBios })}>
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
