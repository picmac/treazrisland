import { apiFetch } from "./client";

export type AssetSummary = {
  cover?: RomAssetSummary;
  screenshots: RomAssetSummary[];
  videos: RomAssetSummary[];
  manuals: RomAssetSummary[];
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

export type ListRomsParams = {
  platform?: string;
  search?: string;
  publisher?: string;
  year?: number;
  sort?: "title" | "releaseYear" | "publisher" | "createdAt";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
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
