import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  SUMMARY_ASSET_TYPES,
  assetSummarySelect,
  buildAssetSummary,
} from "../../utils/asset-summary.js";
import {
  CreativeAssetStatus,
  CreativeAssetUsageKind,
  EnrichmentProvider,
  RomAssetType
} from "../../utils/prisma-enums.js";

type RomAssetTypeValue = (typeof RomAssetType)[keyof typeof RomAssetType];
const ROM_ASSET_TYPE_VALUES = Object.values(RomAssetType) as string[];

const metadataSelect = {
  id: true,
  source: true,
  language: true,
  region: true,
  summary: true,
  developer: true,
  publisher: true,
  genre: true,
  rating: true,
  createdAt: true
} satisfies Prisma.RomMetadataSelect;

const heroArtAssetSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  kind: true,
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  fileSize: true,
  checksumSha256: true,
  updatedAt: true,
} satisfies Prisma.CreativeAssetSelect;

const platformSummaryInclude = {
  _count: { select: { roms: true } },
  roms: {
    take: 1,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      assets: {
        where: { type: { in: SUMMARY_ASSET_TYPES } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: assetSummarySelect
      }
    }
  },
  creativeAssetUsages: {
    where: {
      kind: CreativeAssetUsageKind.PLATFORM_HERO,
      asset: { status: CreativeAssetStatus.ACTIVE }
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      asset: { select: heroArtAssetSelect }
    }
  }
} satisfies Prisma.PlatformInclude;

type PlatformSummaryPlatform = Prisma.PlatformGetPayload<{
  include: typeof platformSummaryInclude;
}>;

type PlatformHeroArt = {
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

function toPlatformSummary(
  platform: PlatformSummaryPlatform,
  heroArt: PlatformHeroArt | null
) {
  const featuredRom = platform.roms[0];
  return {
    id: platform.id,
    name: platform.name,
    slug: platform.slug,
    shortName: platform.shortName,
    screenscraperId: platform.screenscraperId,
    romCount: platform._count.roms,
    heroArt,
    featuredRom: featuredRom
      ? {
          id: featuredRom.id,
          title: featuredRom.title,
          updatedAt: featuredRom.updatedAt,
          assetSummary: buildAssetSummary(featuredRom.assets)
        }
      : null
  };
}

async function resolvePlatformHeroArt(
  app: FastifyInstance,
  platforms: PlatformSummaryPlatform[],
): Promise<Map<string, PlatformHeroArt | null>> {
  const heroArtMap = new Map<string, PlatformHeroArt | null>();

  await Promise.all(
    platforms.map(async (platform) => {
      const usage = platform.creativeAssetUsages[0];
      if (!usage || !usage.asset) {
        heroArtMap.set(platform.id, null);
        return;
      }

      let signed: { url: string; expiresAt: Date } | null = null;
      try {
        signed = await app.storage.getAssetObjectSignedUrl(
          usage.asset.storageKey,
        );
      } catch (error) {
        app.log.warn(
          {
            event: "library.heroArt.signedUrl.failed",
            assetId: usage.asset.id,
            error: error instanceof Error ? error.message : error,
          },
          "Failed to generate signed URL for creative asset hero art",
        );
      }

      heroArtMap.set(platform.id, {
        assetId: usage.asset.id,
        slug: usage.asset.slug,
        kind: usage.asset.kind,
        status: usage.asset.status,
        storageKey: usage.asset.storageKey,
        mimeType: usage.asset.mimeType,
        width: usage.asset.width,
        height: usage.asset.height,
        fileSize: usage.asset.fileSize,
        checksumSha256: usage.asset.checksumSha256,
        signedUrl: signed?.url ?? null,
        signedUrlExpiresAt: signed?.expiresAt.toISOString() ?? null,
        updatedAt: usage.asset.updatedAt.toISOString(),
        notes: usage.notes ?? null,
      });
    }),
  );

  return heroArtMap;
}

const listPlatformsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
  includeEmpty: z
    .preprocess((value) => {
      if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }
        return value === "true" || value === "1";
      }
      if (typeof value === "boolean") {
        return value;
      }
      return undefined;
    }, z.boolean().optional())
    .transform((value) => value ?? false)
});

const listRomsQuerySchema = z.object({
  platform: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
  search: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
  publisher: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 1)
    .optional(),
  sort: z.string().optional(),
  direction: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(24),
  includeHistory: z
    .preprocess((value) => {
      if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }
        return value === "true" || value === "1";
      }
      if (typeof value === "boolean") {
        return value;
      }
      return undefined;
    }, z.boolean().optional())
    .transform((value) => value ?? false),
  assetTypes: z
    .preprocess((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === "string") {
        return value
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
      }
      return undefined;
    }, z.array(z.string()).optional())
    .transform((value) => {
      if (!value || value.length === 0) {
        return undefined;
      }
      const normalized = value
        .map((candidate) => candidate.toUpperCase())
        .filter((candidate): candidate is RomAssetTypeValue =>
          ROM_ASSET_TYPE_VALUES.includes(candidate)
        );
      return normalized.length > 0 ? normalized : undefined;
    }),
  favoritesOnly: z
    .preprocess((value) => {
      if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }
        return value === "true" || value === "1";
      }
      if (typeof value === "boolean") {
        return value;
      }
      return undefined;
    }, z.boolean().optional())
    .transform((value) => value ?? false)
});

const listRomAssetsQuerySchema = z.object({
  types: z
    .preprocess((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === "string") {
        return value
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
      }
      return undefined;
    }, z.array(z.string()).optional())
    .transform((value) => {
      if (!value || value.length === 0) {
        return undefined;
      }
      const valid = value
        .map((candidate) => candidate.toUpperCase())
        .filter((candidate): candidate is RomAssetTypeValue =>
          ROM_ASSET_TYPE_VALUES.includes(candidate)
        );
      return valid.length > 0 ? valid : undefined;
    }),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

function pickPrimaryMetadata(
  metadata: Array<Prisma.RomMetadataGetPayload<{ select: typeof metadataSelect }>>
) {
  return (
    metadata.find((entry) => entry.source === EnrichmentProvider.SCREEN_SCRAPER) ??
    metadata[0] ??
    null
  );
}

export async function registerLibraryRoutes(app: FastifyInstance): Promise<void> {
  const libraryRateLimit = app.rateLimit({
    hook: "preHandler",
    timeWindow: 60_000,
    max: 60
  });

  app.get(
    "/platforms",
    {
      preHandler: [app.authenticate, libraryRateLimit]
    },
    async (request) => {
      const { search, includeEmpty } = listPlatformsQuerySchema.parse(request.query ?? {});

      const where: Prisma.PlatformWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { shortName: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } }
        ];
      }
      if (!includeEmpty) {
        where.roms = { some: {} };
      }

      const platforms = await app.prisma.platform.findMany({
        where,
        orderBy: { name: "asc" },
        include: platformSummaryInclude
      });

      const heroArtMap = await resolvePlatformHeroArt(app, platforms);

      return {
        platforms: platforms.map((platform) =>
          toPlatformSummary(platform, heroArtMap.get(platform.id) ?? null)
        )
      };
    }
  );

  app.get(
    "/platforms/:slug",
    {
      preHandler: [app.authenticate, libraryRateLimit]
    },
    async (request) => {
      const params = z.object({ slug: z.string().min(1) }).parse(request.params);

      const platform = await app.prisma.platform.findUnique({
        where: { slug: params.slug },
        include: platformSummaryInclude
      });

      if (!platform) {
        throw app.httpErrors.notFound("Platform not found");
      }

      const heroArtMap = await resolvePlatformHeroArt(app, [platform]);

      return {
        platform: toPlatformSummary(
          platform,
          heroArtMap.get(platform.id) ?? null
        )
      };
    }
  );

  app.get(
    "/roms",
    {
      preHandler: [app.authenticate, libraryRateLimit]
    },
    async (request) => {
      const parsed = listRomsQuerySchema.parse(request.query ?? {});
      const {
        platform,
        search,
        publisher,
        year,
        sort,
        direction,
        page,
        pageSize,
        includeHistory,
        assetTypes,
        favoritesOnly
      } = parsed;

      const sortFieldMap: Record<string, "title" | "releaseYear" | "publisher" | "createdAt"> = {
        title: "title",
        releaseyear: "releaseYear",
        "release-year": "releaseYear",
        "release_year": "releaseYear",
        releaseYear: "releaseYear",
        publisher: "publisher",
        createdat: "createdAt",
        "created-at": "createdAt",
        "created_at": "createdAt",
        createdAt: "createdAt"
      };

      const sortKey = sort ? sortFieldMap[sort] ?? sortFieldMap[sort.toLowerCase()] : undefined;
      const resolvedSort = sortKey ?? "title";

      if (sort && !sortKey) {
        throw app.httpErrors.badRequest(
          "sort must be one of title, releaseYear, publisher, createdAt"
        );
      }

      const directionValue = direction ? direction.toLowerCase() : "asc";
      if (directionValue !== "asc" && directionValue !== "desc") {
        throw app.httpErrors.badRequest("direction must be asc or desc");
      }

      const sortOrder: Prisma.SortOrder = directionValue === "desc" ? "desc" : "asc";

      const where: Prisma.RomWhereInput = {};
      if (platform) {
        where.platform = { slug: platform };
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { metadata: { some: { summary: { contains: search, mode: "insensitive" } } } }
        ];
      }
      if (publisher) {
        where.metadata = {
          some: {
            publisher: { contains: publisher, mode: "insensitive" }
          }
        };
      }
      if (year) {
        where.releaseYear = year;
      }

      if (favoritesOnly) {
        where.favorites = { some: { userId: request.user.sub } };
      }

      const orderBy: Prisma.RomOrderByWithRelationInput[] = [];
      if (resolvedSort === "title") {
        orderBy.push({ title: sortOrder });
      } else if (resolvedSort === "releaseYear") {
        orderBy.push({ releaseYear: sortOrder });
        orderBy.push({ title: "asc" });
      } else if (resolvedSort === "publisher") {
        orderBy.push({ metadata: { _count: sortOrder } });
        orderBy.push({ title: "asc" });
      } else if (resolvedSort === "createdAt") {
        orderBy.push({ createdAt: sortOrder });
        orderBy.push({ title: "asc" });
      }

      const skip = (page - 1) * pageSize;

      const resolvedAssetTypes = assetTypes ?? [RomAssetType.COVER, RomAssetType.SCREENSHOT];
      const assetTake = assetTypes ? 20 : 2;

      const metadataInclude: Prisma.RomMetadataFindManyArgs = includeHistory
        ? {
            orderBy: { createdAt: "desc" },
            select: metadataSelect
          }
        : {
            orderBy: { createdAt: "desc" },
            select: metadataSelect,
            take: 1
          };

      const [total, roms] = await Promise.all([
        app.prisma.rom.count({ where }),
        app.prisma.rom.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include: {
            platform: {
              select: { id: true, name: true, slug: true, shortName: true }
            },
            assets: {
              where: { type: { in: resolvedAssetTypes } },
              orderBy: { createdAt: "desc" },
              take: assetTake,
              select: assetSummarySelect
            },
            metadata: metadataInclude
          }
        })
      ]);

      return {
        page,
        pageSize,
        total,
        roms: roms.map((rom) => {
          const metadata = pickPrimaryMetadata(rom.metadata);
          return {
            id: rom.id,
            title: rom.title,
            platform: rom.platform,
            releaseYear: rom.releaseYear,
            players: rom.players,
            romSize: rom.romSize,
            screenscraperId: rom.screenscraperId,
            metadata,
            assetSummary: buildAssetSummary(rom.assets),
            metadataHistory: includeHistory ? rom.metadata : undefined
          };
        })
      };
    }
  );

  app.get(
    "/roms/:id",
    {
      preHandler: [app.authenticate, libraryRateLimit]
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const rom = await app.prisma.rom.findUnique({
        where: { id: params.id },
        include: {
          platform: { select: { id: true, name: true, slug: true, shortName: true } },
          metadata: { orderBy: { createdAt: "desc" }, select: metadataSelect },
          assets: { orderBy: { createdAt: "desc" }, select: assetSummarySelect },
          binary: {
            select: {
              id: true,
              storageKey: true,
              originalFilename: true,
              archiveMimeType: true,
              archiveSize: true,
              checksumSha256: true,
              checksumSha1: true,
              checksumMd5: true,
              checksumCrc32: true,
              status: true,
              uploadedAt: true
            }
          },
          enrichmentJobs: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              provider: true,
              status: true,
              providerRomId: true,
              errorMessage: true,
              createdAt: true,
              updatedAt: true
            }
          },
          uploadAudits: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              kind: true,
              storageKey: true,
              originalFilename: true,
              archiveMimeType: true,
              archiveSize: true,
              checksumSha256: true,
              checksumSha1: true,
              checksumMd5: true,
              checksumCrc32: true,
              errorMessage: true,
              createdAt: true
            }
          }
        }
      });

      if (!rom) {
        throw app.httpErrors.notFound("ROM not found");
      }

      return {
        id: rom.id,
        title: rom.title,
        platform: rom.platform,
        releaseYear: rom.releaseYear,
        players: rom.players,
        romSize: rom.romSize,
        romHash: rom.romHash,
        screenscraperId: rom.screenscraperId,
        createdAt: rom.createdAt,
        updatedAt: rom.updatedAt,
        metadata: rom.metadata,
        assets: rom.assets,
        binary: rom.binary,
        enrichmentJobs: rom.enrichmentJobs,
        uploadAudits: rom.uploadAudits
      };
    }
  );

  app.get(
    "/roms/:id/assets",
    {
      preHandler: [app.authenticate, libraryRateLimit]
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const { types, limit } = listRomAssetsQuerySchema.parse(request.query ?? {});

      const assets = await app.prisma.romAsset.findMany({
        where: {
          romId: params.id,
          ...(types ? { type: { in: types } } : {})
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: assetSummarySelect
      });

      if (assets.length === 0) {
        const exists = await app.prisma.rom.count({ where: { id: params.id } });
        if (exists === 0) {
          throw app.httpErrors.notFound("ROM not found");
        }
      }

      return {
        romId: params.id,
        assets,
        assetSummary: buildAssetSummary(assets)
      };
    }
  );
}
