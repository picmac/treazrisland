import {
  PrismaClient,
  type Prisma,
  type Rom,
  type RomAsset,
  type RomAssetType,
} from '@prisma/client';

import { RomStorageError, type RomStorage } from './storage';

export type { RomAssetType };

export const romAssetTypes: readonly RomAssetType[] = ['ROM', 'COVER', 'ARTWORK', 'MANUAL'];

export interface RegisterRomAssetInput {
  type: RomAssetType;
  filename: string;
  contentType: string;
  checksum: string;
  size: number;
  objectKey: string;
}

export interface RegisterRomInput {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  genres?: string[];
  asset: RegisterRomAssetInput;
}

export type RomAssetRecord = RomAsset & { url: string };

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
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: RomStorage,
  ) {}

  async registerRom(input: RegisterRomInput): Promise<RomRecord> {
    const assetMetadata = await this.storage.describeAsset(input.asset.objectKey);
    const normalizedChecksum = input.asset.checksum.toLowerCase();

    if (assetMetadata.size !== input.asset.size) {
      throw new RomStorageError('Uploaded asset size mismatch');
    }

    if (
      assetMetadata.checksum &&
      assetMetadata.checksum.toLowerCase() !== normalizedChecksum
    ) {
      throw new RomStorageError('Uploaded asset checksum mismatch');
    }

    // If this checksum already exists, reuse the existing ROM instead of failing with a 500.
    const existingAsset = await this.prisma.romAsset.findUnique({
      where: { checksum: normalizedChecksum },
      include: { rom: { include: { assets: true } } },
    });

    if (existingAsset?.rom) {
      return this.enrichRomAssets(existingAsset.rom);
    }

    const genres = this.normalizeGenres(input.genres);
    const platformId = await this.resolvePlatformId(input.platformId);

    const rom = await this.prisma.rom.create({
      data: {
        title: input.title,
        description: input.description,
        platformId,
        releaseYear: input.releaseYear,
        genres,
        assets: {
          create: {
            type: input.asset.type,
            uri: `s3://${input.asset.objectKey}`,
            objectKey: input.asset.objectKey,
            checksum: normalizedChecksum,
            contentType: input.asset.contentType,
            size: input.asset.size,
          },
        },
      },
      include: { assets: true },
    });

    return this.enrichRomAssets(rom);
  }

  async list(options: ListRomsOptions = {}): Promise<ListRomsResult> {
    const page = Math.max(1, options.pagination?.page ?? 1);
    const pageSize = Math.max(1, Math.min(50, options.pagination?.pageSize ?? 20));

    const where: Prisma.RomWhereInput = {};

    if (options.filters?.platformId) {
      const platformId = await this.findPlatformId(options.filters.platformId);

      if (!platformId) {
        return {
          items: [],
          meta: { total: 0, page, pageSize, totalPages: 0 },
        };
      }

      where.platformId = platformId;
    }

    if (options.filters?.genre) {
      const normalizedGenre = this.normalizeGenre(options.filters.genre);
      where.genres = { has: normalizedGenre };
    }

    if (options.filters?.favoriteForUserId) {
      where.favorites = { some: { userId: options.filters.favoriteForUserId } };
    }

    const [records, total] = await Promise.all([
      this.prisma.rom.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { assets: true },
      }),
      this.prisma.rom.count({ where }),
    ]);

    const items = await Promise.all(records.map((rom) => this.enrichRomAssets(rom)));
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      items,
      meta: { total, page, pageSize, totalPages },
    };
  }

  async findById(id: string): Promise<RomRecord | undefined> {
    const rom = await this.prisma.rom.findUnique({
      where: { id },
      include: { assets: true },
    });

    if (!rom) {
      return undefined;
    }

    return this.enrichRomAssets(rom);
  }

  async toggleFavorite(userId: string, romId: string): Promise<boolean> {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_romId: { userId, romId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return false;
    }

    await this.prisma.favorite.create({ data: { userId, romId } });
    return true;
  }

  async isFavorite(userId: string, romId: string): Promise<boolean> {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_romId: { userId, romId } },
    });

    return Boolean(favorite);
  }

  private async enrichRomAssets(rom: Rom & { assets: RomAsset[] }): Promise<RomRecord> {
    const assets = await Promise.all(
      rom.assets.map(async (asset) => ({
        ...asset,
        url: await this.storage.getSignedAssetUrl(asset.objectKey),
      })),
    );

    return { ...rom, assets };
  }

  private normalizeGenres(genres?: string[]): string[] {
    if (!genres || genres.length === 0) {
      return [];
    }

    const normalized = genres
      .map((genre) => this.normalizeGenre(genre))
      .filter((genre) => genre.length > 0);

    return Array.from(new Set(normalized));
  }

  private normalizeGenre(value: string): string {
    return value.trim().toLowerCase();
  }

  private async resolvePlatformId(platformIdOrSlug: string): Promise<string> {
    const existing = await this.findPlatformId(platformIdOrSlug);

    if (existing) {
      return existing;
    }

    const slug = this.slugify(platformIdOrSlug);
    const created = await this.prisma.platform.create({
      data: {
        id: slug,
        name: platformIdOrSlug,
        slug,
      },
    });

    return created.id;
  }

  private async findPlatformId(platformIdOrSlug: string): Promise<string | undefined> {
    const byId = await this.prisma.platform.findUnique({ where: { id: platformIdOrSlug } });

    if (byId) {
      return byId.id;
    }

    const slug = this.slugify(platformIdOrSlug);
    const bySlug = await this.prisma.platform.findUnique({ where: { slug } });

    if (bySlug) {
      return bySlug.id;
    }

    return undefined;
  }

  private slugify(value: string): string {
    const normalized = value.trim().toLowerCase();
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return slug.length ? slug : 'platform';
  }
}
