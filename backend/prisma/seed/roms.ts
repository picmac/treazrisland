import { PrismaClient } from "@prisma/client";
import { PLATFORM_SEEDS, TOP_LIST_SEEDS } from "../seed-data.js";

// TODO: Replace inline seed data with curated CSV/JSON metadata exports.
// Binary ROM archives are intentionally excluded from the repository.

const prisma = new PrismaClient();

type RomLookupEntry = { id: string; title: string };

type SeedCounters = {
  roms: number;
  metadata: number;
  assets: number;
  topLists: number;
  topListEntries: number;
};

function buildRomLookupKey(platformSlug: string, title: string): string {
  return `${platformSlug.toLowerCase()}:${title.toLowerCase()}`;
}

async function main(): Promise<void> {
  const lookup = new Map<string, RomLookupEntry>();
  const counters: SeedCounters = {
    roms: 0,
    metadata: 0,
    assets: 0,
    topLists: 0,
    topListEntries: 0
  };

  for (const platformSeed of PLATFORM_SEEDS) {
    const platform = await prisma.platform.findUnique({
      where: { slug: platformSeed.slug }
    });

    if (!platform) {
      console.warn(
        `Skipping ROM seeds for platform ${platformSeed.slug} because it is missing. Run the platform seed first.`,
      );
      continue;
    }

    for (const romSeed of platformSeed.roms) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.rom.findFirst({
          where: { platformId: platform.id, title: romSeed.title }
        });

        const romRecord = existing
          ? await tx.rom.update({
              where: { id: existing.id },
              data: {
                releaseYear: romSeed.releaseYear ?? null,
                players: romSeed.players ?? null,
                romSize: romSeed.romSize ?? null,
                romHash: romSeed.romHash ?? null,
                screenscraperId: romSeed.screenscraperId ?? null
              }
            })
          : await tx.rom.create({
              data: {
                platformId: platform.id,
                title: romSeed.title,
                releaseYear: romSeed.releaseYear ?? null,
                players: romSeed.players ?? null,
                romSize: romSeed.romSize ?? null,
                romHash: romSeed.romHash ?? null,
                screenscraperId: romSeed.screenscraperId ?? null
              }
            });

        const metadataSeeds = romSeed.metadata ?? [];
        if (metadataSeeds.length === 0) {
          await tx.romMetadata.deleteMany({ where: { romId: romRecord.id } });
        } else {
          await tx.romMetadata.deleteMany({
            where: {
              romId: romRecord.id,
              source: { notIn: metadataSeeds.map((entry) => entry.source) }
            }
          });
        }

        let metadataCount = 0;
        for (const metadataSeed of metadataSeeds) {
          await tx.romMetadata.upsert({
            where: {
              romId_source: { romId: romRecord.id, source: metadataSeed.source }
            },
            create: {
              romId: romRecord.id,
              source: metadataSeed.source,
              language: metadataSeed.language ?? null,
              region: metadataSeed.region ?? null,
              summary: metadataSeed.summary ?? null,
              storyline: metadataSeed.storyline ?? null,
              developer: metadataSeed.developer ?? null,
              publisher: metadataSeed.publisher ?? null,
              genre: metadataSeed.genre ?? null,
              rating: metadataSeed.rating ?? null
            },
            update: {
              language: metadataSeed.language ?? null,
              region: metadataSeed.region ?? null,
              summary: metadataSeed.summary ?? null,
              storyline: metadataSeed.storyline ?? null,
              developer: metadataSeed.developer ?? null,
              publisher: metadataSeed.publisher ?? null,
              genre: metadataSeed.genre ?? null,
              rating: metadataSeed.rating ?? null
            }
          });
          metadataCount += 1;
        }

        const assetSeeds = romSeed.assets ?? [];
        if (assetSeeds.length === 0) {
          await tx.romAsset.deleteMany({ where: { romId: romRecord.id } });
        } else {
          await tx.romAsset.deleteMany({
            where: {
              romId: romRecord.id,
              providerId: { notIn: assetSeeds.map((asset) => asset.providerId) }
            }
          });
        }

        let assetCount = 0;
        for (const assetSeed of assetSeeds) {
          await tx.romAsset.upsert({
            where: {
              romId_providerId: {
                romId: romRecord.id,
                providerId: assetSeed.providerId
              }
            },
            create: {
              romId: romRecord.id,
              providerId: assetSeed.providerId,
              type: assetSeed.type,
              source: assetSeed.source,
              language: assetSeed.language ?? null,
              region: assetSeed.region ?? null,
              width: assetSeed.width ?? null,
              height: assetSeed.height ?? null,
              fileSize: assetSeed.fileSize ?? null,
              format: assetSeed.format ?? null,
              checksum: assetSeed.checksum ?? null,
              storageKey: assetSeed.storageKey ?? null,
              externalUrl: assetSeed.externalUrl ?? null
            },
            update: {
              type: assetSeed.type,
              source: assetSeed.source,
              language: assetSeed.language ?? null,
              region: assetSeed.region ?? null,
              width: assetSeed.width ?? null,
              height: assetSeed.height ?? null,
              fileSize: assetSeed.fileSize ?? null,
              format: assetSeed.format ?? null,
              checksum: assetSeed.checksum ?? null,
              storageKey: assetSeed.storageKey ?? null,
              externalUrl: assetSeed.externalUrl ?? null
            }
          });
          assetCount += 1;
        }

        return { rom: romRecord, metadataCount, assetCount };
      });

      lookup.set(
        buildRomLookupKey(platform.slug, romSeed.title),
        result.rom,
      );
      counters.roms += 1;
      counters.metadata += result.metadataCount;
      counters.assets += result.assetCount;
    }
  }

  for (const topListSeed of TOP_LIST_SEEDS) {
    const publishedAt = new Date(topListSeed.publishedAt);
    const effectiveFrom = topListSeed.effectiveFrom
      ? new Date(topListSeed.effectiveFrom)
      : null;
    const effectiveTo = topListSeed.effectiveTo
      ? new Date(topListSeed.effectiveTo)
      : null;

    const topList = await prisma.romTopList.upsert({
      where: { slug: topListSeed.slug },
      create: {
        slug: topListSeed.slug,
        title: topListSeed.title,
        description: topListSeed.description ?? null,
        publishedAt,
        effectiveFrom,
        effectiveTo
      },
      update: {
        title: topListSeed.title,
        description: topListSeed.description ?? null,
        publishedAt,
        effectiveFrom,
        effectiveTo
      }
    });

    await prisma.romTopListEntry.deleteMany({ where: { topListId: topList.id } });

    let entriesCreated = 0;
    for (const entry of topListSeed.entries) {
      const rom = lookup.get(buildRomLookupKey(entry.platformSlug, entry.romTitle));
      if (!rom) {
        console.warn(
          `Unable to seed entry rank ${entry.rank} for list ${topList.slug}: ROM ${entry.romTitle} (${entry.platformSlug}) is missing.`,
        );
        continue;
      }

      await prisma.romTopListEntry.create({
        data: {
          topListId: topList.id,
          romId: rom.id,
          rank: entry.rank,
          blurb: entry.blurb ?? null
        }
      });
      entriesCreated += 1;
      counters.topListEntries += 1;
    }

    counters.topLists += 1;

    if (entriesCreated === 0) {
      console.warn(`Top list ${topList.slug} has no seeded entries.`);
    }
  }

  console.log(
    `Seeded ${counters.roms} ROMs with ${counters.metadata} metadata entries, ${counters.assets} assets, and ${counters.topLists} top lists (${counters.topListEntries} entries).`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed ROM catalog", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
