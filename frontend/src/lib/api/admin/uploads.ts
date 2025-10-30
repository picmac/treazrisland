import { API_BASE, ApiError } from "@lib/api/client";

export type UploadKind = "rom" | "bios";

export type RomUploadMetadata = {
  clientId: string;
  type: "rom";
  originalFilename: string;
  platformSlug: string;
  romTitle?: string;
};

export type BiosUploadMetadata = {
  clientId: string;
  type: "bios";
  originalFilename: string;
  biosCore: string;
  biosRegion?: string;
};

export type UploadMetadata = RomUploadMetadata | BiosUploadMetadata;

export type UploadSuccessResult = {
  status: "success";
  metadata: UploadMetadata;
  romId?: string;
  romTitle?: string;
  platformSlug?: string;
  biosId?: string;
  biosCore?: string;
  storageKey: string;
  archiveSize: number;
  checksumSha256: string;
  uploadAuditId: string;
};

export type UploadDuplicateResult = {
  status: "duplicate";
  metadata: UploadMetadata;
  romId?: string;
  romTitle?: string;
  platformSlug?: string;
  biosId?: string;
  biosCore?: string;
  reason: string;
  uploadAuditId: string;
};

export type UploadResponse = {
  result: UploadSuccessResult | UploadDuplicateResult;
};

export async function uploadAdminArchive(
  metadata: UploadMetadata,
  file: File
): Promise<UploadResponse> {
  const response = await fetch(`${API_BASE}/admin/roms/uploads`, {
    method: "POST",
    body: file,
    cache: "no-store",
    credentials: "include",
    headers: {
      "x-treaz-upload-metadata": JSON.stringify(metadata),
      "Content-Type": file.type || "application/octet-stream"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorText || response.statusText, response.status);
  }

  return (await response.json()) as UploadResponse;
}
