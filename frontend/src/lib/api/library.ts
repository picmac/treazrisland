import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ensureCacheEntry,
  mutateEntry,
  revalidateEntry,
  toSnapshot,
  type SwrCacheEntry,
  type SwrSnapshot
} from "./cache";
import { apiFetch } from "./client";

export type AssetSummary = {
  cover?: RomAssetSummary;
  screenshots: RomAssetSummary[];
  videos: RomAssetSummary[];
  manuals: RomAssetSummary[];
};

export type HeroArtSummary = {
  assetId: string;
  slug: string;
  kind: string;
  status: string;
  storageKey: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
  checksumSha256: string;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  updatedAt: string;
  notes: string | null;
};

export type RomAssetSummary = {
  id: string;
  type: string;
  source: string;
  providerId: string | null;
  language: string | null;
  region: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  format: string | null;
  checksum: string | null;
  storageKey: string | null;
  externalUrl: string | null;
  createdAt: string;
};

export type PlatformSummary = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  screenscraperId: number | null;
  romCount: number;
  heroArt: HeroArtSummary | null;
  featuredRom: {
    id: string;
    title: string;
    updatedAt: string;
    assetSummary: AssetSummary;
  } | null;
};

export type RomMetadata = {
  id: string;
  source: string;
  language: string | null;
  region: string | null;
  summary: string | null;
  storyline: string | null;
  developer: string | null;
  publisher: string | null;
  genre: string | null;
  rating: number | null;
  createdAt: string;
};

export type RomListItem = {
  id: string;
  title: string;
  platform: {
    id: string;
    name: string;
    slug: string;
    shortName: string | null;
  };
  releaseYear: number | null;
  players: number | null;
  romSize: number | null;
  screenscraperId: number | null;
  metadata: RomMetadata | null;
  assetSummary: AssetSummary;
  metadataHistory?: RomMetadata[];
};

export type RomListResponse = {
  page: number;
  pageSize: number;
  total: number;
  roms: RomListItem[];
};

export type RomDetail = {
  id: string;
  title: string;
  platform: RomListItem["platform"];
  releaseYear: number | null;
  players: number | null;
  romSize: number | null;
  romHash: string | null;
  screenscraperId: number | null;
  createdAt: string;
  updatedAt: string;
  metadata: RomMetadata[];
  assets: RomAssetSummary[];
  binary: {
    id: string;
    storageKey: string;
    originalFilename: string;
    archiveMimeType: string | null;
    archiveSize: number;
    checksumSha256: string;
    checksumSha1: string | null;
    checksumMd5: string | null;
    checksumCrc32: string | null;
    status: string;
    uploadedAt: string;
  } | null;
  enrichmentJobs: Array<{
    id: string;
    provider: string;
    status: string;
    providerRomId: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  uploadAudits: Array<{
    id: string;
    status: string;
    kind: string;
    storageKey: string;
    originalFilename: string;
    archiveMimeType: string | null;
    archiveSize: number | null;
    checksumSha256: string | null;
    checksumSha1: string | null;
    checksumMd5: string | null;
    checksumCrc32: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

export type RomAssetsResponse = {
  romId: string;
  assets: RomAssetSummary[];
  assetSummary: AssetSummary;
};

export async function listPlatforms(params: {
  search?: string;
  includeEmpty?: boolean;
} = {}): Promise<{ platforms: PlatformSummary[] }> {
  const query = new URLSearchParams();
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.includeEmpty) {
    query.set("includeEmpty", "true");
  }
  const suffix = query.toString();
  const path = suffix.length > 0 ? `/platforms?${suffix}` : "/platforms";
  return apiFetch(path);
}

export async function getPlatform(slug: string): Promise<{ platform: PlatformSummary }> {
  return apiFetch(`/platforms/${encodeURIComponent(slug)}`);
}

export type ListRomsParams = {
  platform?: string;
  search?: string;
  publisher?: string;
  year?: number;
  sort?: "title" | "releaseYear" | "publisher" | "createdAt";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includeHistory?: boolean;
  assetTypes?: string[];
  favoritesOnly?: boolean;
};

export async function listRoms(params: ListRomsParams = {}): Promise<RomListResponse> {
  const query = new URLSearchParams();
  if (params.platform) {
    query.set("platform", params.platform);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.publisher) {
    query.set("publisher", params.publisher);
  }
  if (typeof params.year === "number") {
    query.set("year", String(params.year));
  }
  if (params.sort) {
    query.set("sort", params.sort);
  }
  if (params.direction) {
    query.set("direction", params.direction);
  }
  if (typeof params.page === "number") {
    query.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    query.set("pageSize", String(params.pageSize));
  }
  if (params.includeHistory) {
    query.set("includeHistory", "true");
  }
  if (params.assetTypes && params.assetTypes.length > 0) {
    query.set("assetTypes", params.assetTypes.join(","));
  }
  if (params.favoritesOnly) {
    query.set("favoritesOnly", "true");
  }
  const suffix = query.toString();
  const path = suffix.length > 0 ? `/roms?${suffix}` : "/roms";
  return apiFetch(path);
}

export async function getRom(id: string): Promise<RomDetail> {
  return apiFetch(`/roms/${encodeURIComponent(id)}`);
}

export async function listRomAssets(
  id: string,
  params: { types?: string[]; limit?: number } = {}
): Promise<RomAssetsResponse> {
  const query = new URLSearchParams();
  if (params.types && params.types.length > 0) {
    query.set("types", params.types.join(","));
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  const suffix = query.toString();
  const path = suffix.length > 0 ? `/roms/${encodeURIComponent(id)}/assets?${suffix}` : `/roms/${encodeURIComponent(id)}/assets`;
  return apiFetch(path);
}

type UsePlatformLibraryParams = {
  search?: string;
  includeEmpty?: boolean;
};

type UsePlatformLibraryResult = SwrSnapshot<{ platforms: PlatformSummary[] }> & {
  refresh: () => Promise<void>;
  mutate: (updater: (current: { platforms: PlatformSummary[] } | null) => { platforms: PlatformSummary[] } | null | undefined) => void;
  key: string;
};

const platformCache = new Map<string, SwrCacheEntry<{ platforms: PlatformSummary[] }>>();

function normalisePlatformParams(params: UsePlatformLibraryParams = {}) {
  const search = params.search?.trim() ?? "";
  return {
    search: search.length > 0 ? search : null,
    includeEmpty: Boolean(params.includeEmpty)
  };
}

function platformCacheKey(params: ReturnType<typeof normalisePlatformParams>): string {
  return `platforms:${params.search ?? ""}:${params.includeEmpty ? "1" : "0"}`;
}

export function usePlatformLibrary(params: UsePlatformLibraryParams = {}): UsePlatformLibraryResult {
  const normalised = normalisePlatformParams(params);
  const key = platformCacheKey(normalised);
  const requestSearch = normalised.search ?? undefined;
  const requestIncludeEmpty = normalised.includeEmpty ? true : undefined;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = ensureCacheEntry(platformCache, key);
      entry.subscribers.add(onStoreChange);
      return () => {
        entry.subscribers.delete(onStoreChange);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(
    () => toSnapshot(ensureCacheEntry(platformCache, key)),
    [key]
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const entry = ensureCacheEntry(platformCache, key);
    void revalidateEntry(entry, () =>
      listPlatforms({
        search: requestSearch,
        includeEmpty: requestIncludeEmpty
      })
    );
  }, [key, requestIncludeEmpty, requestSearch]);

  const refresh = useCallback(async () => {
    const entry = ensureCacheEntry(platformCache, key);
    await revalidateEntry(entry, () =>
      listPlatforms({
        search: requestSearch,
        includeEmpty: requestIncludeEmpty
      })
    );
  }, [key, requestIncludeEmpty, requestSearch]);

  const mutate = useCallback(
    (
      updater: (current: { platforms: PlatformSummary[] } | null) => { platforms: PlatformSummary[] } | null | undefined
    ) => {
      const entry = ensureCacheEntry(platformCache, key);
      mutateEntry(entry, updater);
    },
    [key]
  );

  return {
    ...snapshot,
    refresh: async () => {
      await refresh();
    },
    mutate,
    key
  };
}

type UseRomLibraryResult = SwrSnapshot<RomListResponse> & {
  refresh: () => Promise<void>;
  mutate: (updater: (current: RomListResponse | null) => RomListResponse | null | undefined) => void;
  key: string;
};

const romListCache = new Map<string, SwrCacheEntry<RomListResponse>>();

function normaliseRomParams(params: ListRomsParams = {}) {
  const assetTypes = Array.isArray(params.assetTypes)
    ? params.assetTypes.map((type) => type.trim()).filter((value) => value.length > 0).sort()
    : [];
  const search = params.search?.trim() ?? "";
  const publisher = params.publisher?.trim() ?? "";
  const year = typeof params.year === "number" ? params.year : null;
  return {
    platform: params.platform?.trim() ?? null,
    search: search.length > 0 ? search : null,
    publisher: publisher.length > 0 ? publisher : null,
    year,
    sort: params.sort ?? "title",
    direction: params.direction ?? "asc",
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
    includeHistory: Boolean(params.includeHistory),
    assetTypes,
    favoritesOnly: Boolean(params.favoritesOnly)
  };
}

function romCacheKey(params: ReturnType<typeof normaliseRomParams>): string {
  return `roms:${JSON.stringify(params)}`;
}

export function useRomLibrary(params: ListRomsParams = {}): UseRomLibraryResult {
  const normalised = normaliseRomParams(params);
  const key = romCacheKey(normalised);
  const assetTypesKey = normalised.assetTypes.join("|");

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = ensureCacheEntry(romListCache, key);
      entry.subscribers.add(onStoreChange);
      return () => {
        entry.subscribers.delete(onStoreChange);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(
    () => toSnapshot(ensureCacheEntry(romListCache, key)),
    [key]
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const entry = ensureCacheEntry(romListCache, key);
    const request: ListRomsParams = {
      platform: normalised.platform ?? undefined,
      search: normalised.search ?? undefined,
      publisher: normalised.publisher ?? undefined,
      year: normalised.year ?? undefined,
      sort: normalised.sort,
      direction: normalised.direction,
      page: normalised.page,
      pageSize: normalised.pageSize,
      includeHistory: normalised.includeHistory || undefined,
      assetTypes: normalised.assetTypes.length > 0 ? normalised.assetTypes : undefined,
      favoritesOnly: normalised.favoritesOnly || undefined
    };
    void revalidateEntry(entry, () => listRoms(request));
  }, [
    key,
    normalised.direction,
    normalised.favoritesOnly,
    normalised.includeHistory,
    normalised.page,
    normalised.pageSize,
    normalised.platform,
    normalised.publisher,
    normalised.search,
    normalised.sort,
    normalised.year,
    normalised.assetTypes
  ]);

  const refresh = useCallback(async () => {
    const entry = ensureCacheEntry(romListCache, key);
    const request: ListRomsParams = {
      platform: normalised.platform ?? undefined,
      search: normalised.search ?? undefined,
      publisher: normalised.publisher ?? undefined,
      year: normalised.year ?? undefined,
      sort: normalised.sort,
      direction: normalised.direction,
      page: normalised.page,
      pageSize: normalised.pageSize,
      includeHistory: normalised.includeHistory || undefined,
      assetTypes: normalised.assetTypes.length > 0 ? normalised.assetTypes : undefined,
      favoritesOnly: normalised.favoritesOnly || undefined
    };
    await revalidateEntry(entry, () => listRoms(request));
  }, [
    key,
    normalised.direction,
    normalised.favoritesOnly,
    normalised.includeHistory,
    normalised.page,
    normalised.pageSize,
    normalised.platform,
    normalised.publisher,
    normalised.search,
    normalised.sort,
    normalised.year,
    normalised.assetTypes
  ]);

  const mutate = useCallback(
    (updater: (current: RomListResponse | null) => RomListResponse | null | undefined) => {
      const entry = ensureCacheEntry(romListCache, key);
      mutateEntry(entry, updater);
    },
    [key]
  );

  return {
    ...snapshot,
    refresh: async () => {
      await refresh();
    },
    mutate,
    key
  };
}

type UseRomDetailResult = SwrSnapshot<RomDetail> & {
  refresh: () => Promise<void>;
  mutate: (updater: (current: RomDetail | null) => RomDetail | null | undefined) => void;
  key: string;
};

const romDetailCache = new Map<string, SwrCacheEntry<RomDetail>>();

export function useRomDetail(id: string | null | undefined): UseRomDetailResult {
  const romId = id?.trim() ?? "";
  const key = romId.length > 0 ? `rom:${romId}` : null;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!key) {
        return () => {};
      }
      const entry = ensureCacheEntry(romDetailCache, key);
      entry.subscribers.add(onStoreChange);
      return () => {
        entry.subscribers.delete(onStoreChange);
      };
    },
    [key]
  );

  const getSnapshot = useCallback((): SwrSnapshot<RomDetail> => {
    if (!key) {
      return {
        data: null,
        error: null,
        isLoading: false,
        isValidating: false
      };
    }
    return toSnapshot(ensureCacheEntry(romDetailCache, key));
  }, [key]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!key) {
      return;
    }
    const entry = ensureCacheEntry(romDetailCache, key);
    void revalidateEntry(entry, () => getRom(romId));
  }, [key, romId]);

  const refresh = useCallback(async () => {
    if (!key) {
      return;
    }
    const entry = ensureCacheEntry(romDetailCache, key);
    await revalidateEntry(entry, () => getRom(romId));
  }, [key, romId]);

  const mutate = useCallback(
    (updater: (current: RomDetail | null) => RomDetail | null | undefined) => {
      if (!key) {
        return;
      }
      const entry = ensureCacheEntry(romDetailCache, key);
      mutateEntry(entry, updater);
    },
    [key]
  );

  return {
    ...snapshot,
    refresh: async () => {
      await refresh();
    },
    mutate,
    key: key ?? "rom:"
  };
}
