import { PrismaClient, RomAssetType, SessionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const platforms = await Promise.all(
    [
      { name: "Nintendo Entertainment System", slug: "nes" },
      { name: "Super Nintendo Entertainment System", slug: "snes" },
    ].map((platform) =>
      prisma.platform.upsert({
        where: { slug: platform.slug },
        update: {},
        create: platform,
      })
    )
  );

  const nes = platforms.find((platform) => platform.slug === "nes");
  const snes = platforms.find((platform) => platform.slug === "snes");

  if (!nes || !snes) {
    throw new Error("Unable to seed platforms");
  }

  const roms = await Promise.all([
    prisma.rom.upsert({
      where: { id: "super-mario-bros" },
      update: {},
      create: {
        id: "super-mario-bros",
        title: "Super Mario Bros.",
        description: "Classic platformer featuring Mario and Luigi.",
        releaseYear: 1985,
        platformId: nes.id,
        assets: {
          create: [
            {
              type: RomAssetType.ROM,
              uri: "https://example.com/roms/super-mario-bros.nes",
            },
            {
              type: RomAssetType.COVER,
              uri: "https://example.com/art/super-mario-bros-cover.jpg",
            },
          ],
        },
      },
      include: { assets: true },
    }),
    prisma.rom.upsert({
      where: { id: "the-legend-of-zelda-a-link-to-the-past" },
      update: {},
      create: {
        id: "the-legend-of-zelda-a-link-to-the-past",
        title: "The Legend of Zelda: A Link to the Past",
        description: "Action-adventure game set in the world of Hyrule.",
        releaseYear: 1991,
        platformId: snes.id,
        assets: {
          create: [
            {
              type: RomAssetType.ROM,
              uri: "https://example.com/roms/zelda-a-link-to-the-past.sfc",
            },
            {
              type: RomAssetType.MANUAL,
              uri: "https://example.com/manuals/zelda-a-link-to-the-past.pdf",
            },
          ],
        },
      },
      include: { assets: true },
    }),
  ]);

  const user = await prisma.user.upsert({
    where: { email: "player@example.com" },
    update: {
      lastLoginAt: new Date(),
    },
    create: {
      email: "player@example.com",
      username: "player1",
      displayName: "Player One",
      passwordHash: "hashed-password",
      lastLoginAt: new Date(),
    },
  });

  const invite = await prisma.invite.upsert({
    where: { code: "WELCOME-2024" },
    update: {},
    create: {
      code: "WELCOME-2024",
      createdBy: {
        connect: { id: user.id },
      },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const session = await prisma.session.upsert({
    where: { sessionToken: "session-token-1" },
    update: {
      status: SessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
    create: {
      userId: user.id,
      sessionToken: "session-token-1",
      status: SessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const saveState = await prisma.saveState.upsert({
    where: {
      userId_romId_slot: {
        userId: user.id,
        romId: roms[0].id,
        slot: 0,
      },
    },
    update: {
      data: Buffer.from("sample-state-data"),
      label: "World 1-1",
    },
    create: {
      userId: user.id,
      romId: roms[0].id,
      slot: 0,
      label: "World 1-1",
      data: Buffer.from("sample-state-data"),
    },
  });

  const favorite = await prisma.favorite.upsert({
    where: {
      userId_romId: {
        userId: user.id,
        romId: roms[1].id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      romId: roms[1].id,
    },
  });

  console.log("Seed completed", {
    platforms: platforms.length,
    roms: roms.length,
    invite: invite.code,
    session: session.sessionToken,
    saveState: saveState.id,
    favorite: favorite.id,
  });
}

main()
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
