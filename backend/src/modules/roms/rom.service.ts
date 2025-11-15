import { randomUUID } from 'node:crypto';

import type { Rom, RomAsset, RomAssetType } from '@prisma/client';

export type { RomAssetType };

export const romAssetTypes: readonly RomAssetType[] = ['ROM', 'COVER', 'ARTWORK', 'MANUAL'];

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
  genres?: string[];
  asset: RegisterRomAssetInput;
}

export type RomAssetRecord = RomAsset;

export type RomRecord = Rom & { assets: RomAssetRecord[] };

export interface ListRomFilters {
  platformId?: string;
  genre?: string;
  favoriteForUserId?: string;
}

export interface ListRomsOptions {
  filters?: ListRomFilters;
  pagination?: {
    page?: number;
    pageSize?: number;
  };
}

export interface ListRomsResult {
  items: RomRecord[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export class RomService {
  private readonly roms = new Map<string, RomRecord>();

  private readonly favorites = new Map<string, Set<string>>();

  registerRom(input: RegisterRomInput): RomRecord {
    const id = randomUUID();
    const now = new Date();
    const asset: RomAssetRecord = {
      id: randomUUID(),
      romId: id,
      type: input.asset.type,
      uri: input.asset.uri,
      objectKey: input.asset.objectKey,
      checksum: input.asset.checksum.toLowerCase(),
      contentType: input.asset.contentType,
      size: input.asset.size,
      createdAt: now,
    };

    const genres = this.normalizeGenres(input.genres);

    const rom: RomRecord = {
      id,
      title: input.title,
      description: input.description,
      platformId: input.platformId,
      releaseYear: input.releaseYear,
      genres,
      createdAt: now,
      updatedAt: now,
      assets: [asset],
    };

    this.roms.set(id, rom);
    return rom;
  }

  list(options: ListRomsOptions = {}): ListRomsResult {
    const page = Math.max(1, options.pagination?.page ?? 1);
    const pageSize = Math.max(1, Math.min(50, options.pagination?.pageSize ?? 20));

    const filters = options.filters ?? {};
    let roms = Array.from(this.roms.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    if (filters.platformId) {
      roms = roms.filter((rom) => rom.platformId === filters.platformId);
    }

    if (filters.genre) {
      const targetGenre = filters.genre.toLowerCase();
      roms = roms.filter((rom) => rom.genres.some((genre) => genre.toLowerCase() === targetGenre));
    }

    if (filters.favoriteForUserId) {
      const favorites = this.favorites.get(filters.favoriteForUserId);
      if (!favorites || favorites.size === 0) {
        roms = [];
      } else {
        roms = roms.filter((rom) => favorites.has(rom.id));
      }
    }

    const total = roms.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const items = roms.slice(startIndex, startIndex + pageSize);

    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  }

  findById(id: string): RomRecord | undefined {
    return this.roms.get(id);
  }

  toggleFavorite(userId: string, romId: string): boolean {
    const favorites = this.favorites.get(userId) ?? new Set<string>();

    let isFavorite = true;
    if (favorites.has(romId)) {
      favorites.delete(romId);
      isFavorite = false;
    } else {
      favorites.add(romId);
    }

    this.favorites.set(userId, favorites);
    return isFavorite;
  }

  isFavorite(userId: string, romId: string): boolean {
    return this.favorites.get(userId)?.has(romId) ?? false;
  }

  private normalizeGenres(genres?: string[]): string[] {
    if (!genres || genres.length === 0) {
      return [];
    }

    const normalized = genres.map((genre) => genre.trim()).filter((genre) => genre.length > 0);

    return Array.from(new Set(normalized));
  }
}
