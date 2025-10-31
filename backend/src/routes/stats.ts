import type { FastifyInstance } from "fastify";
import prisma from "@prisma/client";

const { RomBinaryStatus, RomUploadStatus } = prisma;

function createStatsRateLimit(app: FastifyInstance) {
  return app.rateLimit({
    hook: "preHandler",
    timeWindow: 60_000,
    max: (request) => (request.user?.role === "ADMIN" ? 120 : 40),
  });
}

const platformSelect = {
  id: true,
  name: true,
  slug: true,
  shortName: true,
} as const;

export async function registerStatsRoutes(app: FastifyInstance): Promise<void> {
  const rateLimitHook = createStatsRateLimit(app);

  app.get(
    "/stats/overview",
    {
      preHandler: [app.authenticate, rateLimitHook],
    },
    async (request) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const userId = request.user.sub;

      const [
        totalUsers,
        totalRoms,
        romBinaryAggregate,
        serverPlayStateAggregate,
        romAssetAggregate,
        userFavoritesCount,
        userUploadsCount,
        userPlayStateAggregate,
        userPlayStateContexts,
      ] = await Promise.all([
        app.prisma.user.count(),
        app.prisma.rom.count(),
        app.prisma.romBinary.aggregate({
          where: { status: RomBinaryStatus.READY },
          _sum: { archiveSize: true },
        }),
        app.prisma.playState.aggregate({
          _count: { _all: true },
          _sum: { size: true },
        }),
        app.prisma.romAsset.aggregate({
          _sum: { fileSize: true },
        }),
        app.prisma.userRomFavorite.count({
          where: { userId },
        }),
        app.prisma.romUploadAudit.count({
          where: { uploadedById: userId, status: RomUploadStatus.SUCCEEDED },
        }),
        app.prisma.playState.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { size: true },
        }),
        app.prisma.playState.findMany({
          where: { userId },
          select: {
            rom: {
              select: {
                platform: { select: platformSelect },
              },
            },
          },
        }),
      ]);

      const romBinaryBytes = Number(romBinaryAggregate._sum.archiveSize ?? 0);
      const assetBytes = Number(romAssetAggregate._sum.fileSize ?? 0);
      const playStateBytes = Number(serverPlayStateAggregate._sum.size ?? 0);
      const totalStorageBytes = romBinaryBytes + assetBytes + playStateBytes;

      const userPlayStateCount = Number(userPlayStateAggregate._count._all ?? 0);
      const userPlayStateBytes = Number(userPlayStateAggregate._sum.size ?? 0);

      const platformTally = new Map<
        string,
        {
          count: number;
          platform: {
            id: string;
            name: string;
            slug: string;
            shortName: string | null;
          };
        }
      >();

      for (const context of userPlayStateContexts) {
        const platform = context.rom?.platform;
        if (!platform) {
          continue;
        }
        const existing = platformTally.get(platform.id);
        if (existing) {
          existing.count += 1;
        } else {
          platformTally.set(platform.id, {
            count: 1,
            platform: {
              id: platform.id,
              name: platform.name,
              slug: platform.slug,
              shortName: platform.shortName,
            },
          });
        }
      }

      const topPlatforms = Array.from(platformTally.values())
        .sort((a, b) => {
          if (a.count === b.count) {
            return a.platform.name.localeCompare(b.platform.name);
          }
          return b.count - a.count;
        })
        .slice(0, 3)
        .map((entry) => ({
          id: entry.platform.id,
          name: entry.platform.name,
          slug: entry.platform.slug,
          shortName: entry.platform.shortName,
          playStateCount: entry.count,
        }));

      return {
        user: {
          favorites: {
            count: userFavoritesCount,
          },
          playStates: {
            count: userPlayStateCount,
            totalBytes: userPlayStateBytes,
          },
          uploads: {
            count: userUploadsCount,
          },
          topPlatforms,
        },
        server: {
          users: totalUsers,
          roms: totalRoms,
          playStates: Number(serverPlayStateAggregate._count._all ?? 0),
          storageBytes: {
            romBinaries: romBinaryBytes,
            assets: assetBytes,
            playStates: playStateBytes,
            total: totalStorageBytes,
          },
        },
      };
    },
  );
}
