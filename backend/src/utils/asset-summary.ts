import type { RomAsset } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { RomAssetType } from "./prisma-enums.js";

export const SUMMARY_ASSET_TYPES: RomAssetType[] = [
  RomAssetType.COVER,
  RomAssetType.SCREENSHOT,
  RomAssetType.VIDEO,
  RomAssetType.MANUAL,
];

export const assetSummarySelect = {
  id: true,
  type: true,
  source: true,
  providerId: true,
  language: true,
  region: true,
  width: true,
  height: true,
  fileSize: true,
  format: true,
  checksum: true,
  storageKey: true,
  externalUrl: true,
  createdAt: true,
} satisfies Prisma.RomAssetSelect;

export type RomAssetSummary = Pick<
  RomAsset,
  | "id"
  | "type"
  | "source"
  | "providerId"
  | "language"
  | "region"
  | "width"
  | "height"
  | "fileSize"
  | "format"
  | "checksum"
  | "storageKey"
  | "externalUrl"
  | "createdAt"
>;

export type AssetSummary = {
  cover?: RomAssetSummary;
  screenshots: RomAssetSummary[];
  videos: RomAssetSummary[];
  manuals: RomAssetSummary[];
};

export function buildAssetSummary(assets: RomAssetSummary[]): AssetSummary {
  const summary: AssetSummary = {
    screenshots: [],
    videos: [],
    manuals: [],
  };

  for (const asset of assets) {
    switch (asset.type) {
      case RomAssetType.COVER:
        if (!summary.cover) {
          summary.cover = asset;
        }
        break;
      case RomAssetType.SCREENSHOT:
        summary.screenshots.push(asset);
        break;
      case RomAssetType.VIDEO:
        summary.videos.push(asset);
        break;
      case RomAssetType.MANUAL:
        summary.manuals.push(asset);
        break;
      default:
        break;
    }
  }

  return summary;
}
