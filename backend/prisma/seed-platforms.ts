import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const platforms = [
  {
    slug: "nes",
    name: "Nintendo Entertainment System",
    shortName: "NES",
    screenscraperId: 1
  },
  {
    slug: "snes",
    name: "Super Nintendo Entertainment System",
    shortName: "SNES",
    screenscraperId: 4
  },
  {
    slug: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    screenscraperId: 14
  },
  {
    slug: "gba",
    name: "Nintendo Game Boy Advance",
    shortName: "GBA",
    screenscraperId: 12
  },
  {
    slug: "gb",
    name: "Nintendo Game Boy",
    shortName: "GB",
    screenscraperId: 9
  },
  {
    slug: "gbc",
    name: "Nintendo Game Boy Color",
    shortName: "GBC",
    screenscraperId: 10
  },
  {
    slug: "genesis",
    name: "Sega Mega Drive / Genesis",
    shortName: "Genesis",
    screenscraperId: 29
  },
  {
    slug: "dreamcast",
    name: "Sega Dreamcast",
    shortName: "Dreamcast",
    screenscraperId: 23
  },
  {
    slug: "ps1",
    name: "Sony PlayStation",
    shortName: "PS1",
    screenscraperId: 57
  },
  {
    slug: "ps2",
    name: "Sony PlayStation 2",
    shortName: "PS2",
    screenscraperId: 80
  },
  {
    slug: "psp",
    name: "Sony PlayStation Portable",
    shortName: "PSP",
    screenscraperId: 86
  },
  {
    slug: "saturn",
    name: "Sega Saturn",
    shortName: "Saturn",
    screenscraperId: 46
  }
] as const;

async function main(): Promise<void> {
  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      update: {
        name: platform.name,
        shortName: platform.shortName,
        screenscraperId: platform.screenscraperId
      },
      create: {
        slug: platform.slug,
        name: platform.name,
        shortName: platform.shortName,
        screenscraperId: platform.screenscraperId
      }
    });
  }

  const seeded = await prisma.platform.count({
    where: { slug: { in: platforms.map((platform) => platform.slug) } }
  });

  console.log(`Seeded ${seeded} platforms.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed platforms", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
