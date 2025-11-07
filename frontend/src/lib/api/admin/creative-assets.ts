import { API_BASE, ApiError, apiFetch } from "@lib/api/client";

export type CreativeAssetKind = "HERO" | "BACKGROUND" | "BANNER";
export type CreativeAssetStatus = "ACTIVE" | "ARCHIVED";
export type CreativeAssetUsageKind = "LIBRARY_HERO" | "PLATFORM_HERO";

export type CreativeAssetUsage = {
  id: string;
  kind: CreativeAssetUsageKind;
  targetKey: string;
  platform: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
  } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeAsset = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: CreativeAssetKind;
  status: CreativeAssetStatus;
  originalFilename: string;
  storageKey: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
  checksumSha256: string;
  checksumSha1: string | null;
  checksumMd5: string | null;
  createdAt: string;
  updatedAt: string;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  usages: CreativeAssetUsage[];
};

export type ListCreativeAssetsResponse = {
  assets: CreativeAsset[];
};

const METADATA_HEADER = "x-treaz-asset-metadata";

export async function listCreativeAssets(): Promise<ListCreativeAssetsResponse> {
  return apiFetch("/admin/creative-assets");
}

export type CreateCreativeAssetMetadata = {
  slug: string;
  title: string;
  description?: string;
  kind?: CreativeAssetKind;
  status?: CreativeAssetStatus;
  width?: number;
  height?: number;
  usages?: Array<{
    kind: CreativeAssetUsageKind;
    platformSlug?: string;
    notes?: string;
  }>;
};

export async function createCreativeAsset(
  metadata: CreateCreativeAssetMetadata,
  file: File
): Promise<{ asset: CreativeAsset }> {
  const payloadMetadata = {
    ...metadata,
    originalFilename: file.name,
    contentType: file.type || "application/octet-stream"
  };

  const response = await fetch(`${API_BASE}/admin/creative-assets`, {
    method: "POST",
    body: file,
    cache: "no-store",
    credentials: "include",
    headers: {
      [METADATA_HEADER]: JSON.stringify(payloadMetadata),
      "Content-Type": file.type || "application/octet-stream"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || response.statusText, response.status);
  }

  return (await response.json()) as { asset: CreativeAsset };
}

export async function replaceCreativeAssetFile(
  assetId: string,
  file: File,
  metadata: { width?: number; height?: number }
): Promise<{ asset: CreativeAsset }> {
  const payloadMetadata = {
    originalFilename: file.name,
    contentType: file.type || "application/octet-stream",
    ...metadata
  };

  const response = await fetch(`${API_BASE}/admin/creative-assets/${assetId}/file`, {
    method: "POST",
    body: file,
    cache: "no-store",
    credentials: "include",
    headers: {
      [METADATA_HEADER]: JSON.stringify(payloadMetadata),
      "Content-Type": file.type || "application/octet-stream"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || response.statusText, response.status);
  }

  return (await response.json()) as { asset: CreativeAsset };
}

export async function updateCreativeAsset(
  assetId: string,
  patch: Partial<{ title: string; description: string | null; status: CreativeAssetStatus; kind: CreativeAssetKind }>
): Promise<{ asset: CreativeAsset }> {
  return apiFetch(`/admin/creative-assets/${assetId}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export async function deleteCreativeAsset(assetId: string): Promise<void> {
  await apiFetch(`/admin/creative-assets/${assetId}`, { method: "DELETE" });
}

export async function assignCreativeAssetUsage(
  assetId: string,
  usage: { kind: CreativeAssetUsageKind; platformSlug?: string; notes?: string }
): Promise<{ asset: CreativeAsset }> {
  return apiFetch(`/admin/creative-assets/${assetId}/usages`, {
    method: "POST",
    body: JSON.stringify(usage)
  });
}

export async function removeCreativeAssetUsage(
  assetId: string,
  usageId: string
): Promise<{ asset: CreativeAsset }> {
  return apiFetch(`/admin/creative-assets/${assetId}/usages/${usageId}`, {
    method: "DELETE"
  });
}
