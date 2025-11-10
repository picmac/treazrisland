import type { UploadDuplicateResult, UploadSuccessResult } from "@lib/api/uploads";

export type UploadStatus = "pending" | "uploading" | "success" | "duplicate" | "error";

export type UploadItem = {
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

export type UploadPlatform = {
  id: string;
  slug: string;
  name: string;
};

export type UploadQueueStats = {
  total: number;
  success: number;
  duplicate: number;
  error: number;
};
