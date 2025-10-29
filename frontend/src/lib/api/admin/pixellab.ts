import { apiFetch } from "@lib/api/client";

export type PixelLabRenderSummary = {
  id: string;
  cacheKey: string;
  prompt: string;
  styleId: string;
  cacheHit: boolean;
  statusCode?: number;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
  rom?: { id: string; title: string } | null;
  romAsset?: { id: string; type: string } | null;
};

export type PixelLabCacheEntrySummary = {
  id: string;
  cacheKey: string;
  prompt: string;
  styleId: string;
  romId: string | null;
  romTitle: string | null;
  romAssetId: string | null;
  assetType: string | null;
  expiresAt: string | null;
  updatedAt: string;
  lastRequestedAt: string;
  hitCount: number;
  missCount: number;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  fileSize: number | null;
};

export type PixelLabCacheSummary = {
  summary: {
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
    staleEntries: number;
    latestRenderAt: string | null;
  };
  entries: PixelLabCacheEntrySummary[];
};

export async function listPixelLabRenders(limit = 25): Promise<{ renders: PixelLabRenderSummary[] }> {
  const query = new URLSearchParams();
  if (limit) {
    query.set("limit", String(limit));
  }
  const suffix = query.toString();
  const path = suffix.length > 0 ? `/admin/pixellab/renders?${suffix}` : "/admin/pixellab/renders";
  return apiFetch(path);
}

export async function getPixelLabCache(limit = 50): Promise<PixelLabCacheSummary> {
  const query = new URLSearchParams();
  if (limit) {
    query.set("limit", String(limit));
  }
  const suffix = query.toString();
  const path = suffix.length > 0 ? `/admin/pixellab/cache?${suffix}` : "/admin/pixellab/cache";
  return apiFetch(path);
}

export async function requestPixelLabRender(payload: {
  romId: string;
  prompt: string;
  styleId?: string;
  forceRefresh?: boolean;
  assetType?: string;
}): Promise<{ result: unknown }> {
  return apiFetch("/admin/pixellab/renders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function regeneratePixelLabRender(cacheKey: string, overrides: { styleId?: string } = {}): Promise<{
  result: unknown;
}> {
  return apiFetch(`/admin/pixellab/renders/${encodeURIComponent(cacheKey)}/regenerate`, {
    method: "POST",
    body: JSON.stringify(overrides)
  });
}
