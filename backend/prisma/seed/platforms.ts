import { PrismaClient } from "@prisma/client";
import { PLATFORM_SEEDS } from "../seed-data.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const platform of PLATFORM_SEEDS) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      update: {
        name: platform.name,
        shortName: platform.shortName,
        screenscraperId: platform.screenscraperId ?? null
      },
      create: {
        slug: platform.slug,
        name: platform.name,
        shortName: platform.shortName,
        screenscraperId: platform.screenscraperId ?? null
      }
    });
  }

  const seeded = await prisma.platform.count({
    where: { slug: { in: PLATFORM_SEEDS.map((platform) => platform.slug) } }
  });

  const romTemplates = PLATFORM_SEEDS.reduce((total, entry) => total + entry.roms.length, 0);

  console.log(
    `Seeded ${seeded} platforms and registered ${romTemplates} ROM templates.`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed platforms", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
