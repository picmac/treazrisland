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
}

export interface RomDetails extends RomSummary {
  assets: RomAsset[];
}
