import { randomUUID } from 'node:crypto';

export const romAssetTypes: ['ROM', 'COVER', 'ARTWORK', 'MANUAL'] = [
  'ROM',
  'COVER',
  'ARTWORK',
  'MANUAL',
];
export type RomAssetType = (typeof romAssetTypes)[number];

export interface RegisterRomAssetInput {
  type: RomAssetType;
  uri: string;
  objectKey: string;
  checksum: string;
  contentType: string;
  size: number;
}

export interface RegisterRomInput {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  asset: RegisterRomAssetInput;
}

export interface RomAssetRecord extends RegisterRomAssetInput {
  id: string;
  createdAt: Date;
}

export interface RomRecord {
  id: string;
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  createdAt: Date;
  updatedAt: Date;
  assets: RomAssetRecord[];
}

export class RomService {
  private readonly roms = new Map<string, RomRecord>();

  registerRom(input: RegisterRomInput): RomRecord {
    const id = randomUUID();
    const now = new Date();
    const asset: RomAssetRecord = {
      id: randomUUID(),
      ...input.asset,
      checksum: input.asset.checksum.toLowerCase(),
      createdAt: now,
    };

    const rom: RomRecord = {
      id,
      title: input.title,
      description: input.description,
      platformId: input.platformId,
      releaseYear: input.releaseYear,
      createdAt: now,
      updatedAt: now,
      assets: [asset],
    };

    this.roms.set(id, rom);
    return rom;
  }

  list(): RomRecord[] {
    return Array.from(this.roms.values());
  }

  findById(id: string): RomRecord | undefined {
    return this.roms.get(id);
  }
}
