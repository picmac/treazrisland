import clsx from "clsx";

import type { UploadStatus } from "@/src/uploads/types";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatStatus(status: UploadStatus): string {
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

export function getStatusClass(status: UploadStatus): string {
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

export function deriveRomTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function statusBadgeClass(status: UploadStatus): string {
  return clsx("rounded px-2 py-1", getStatusClass(status));
}
