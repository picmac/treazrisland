export type RomAssetType = 'ROM' | 'COVER' | 'ARTWORK' | 'MANUAL';

export interface RomAsset {
  id: string;
  type: RomAssetType;
  checksum: string;
  contentType: string;
  size: number;
  createdAt: string;
  url: string;
}

export interface PlatformSummary {
  id: string;
  name: string;
  slug: string;
}

export interface SaveStateSummary {
  total: number;
  latest?: {
    id: string;
    slot: number;
    label?: string | null;
    size: number;
    contentType: string;
    checksum: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface RomSummary {
  id: string;
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  genres: string[];
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  lastPlayedAt?: string;
}

export interface RomDetails extends RomSummary {
  assets: RomAsset[];
  platform?: PlatformSummary;
  saveStateSummary?: SaveStateSummary | null;
}
