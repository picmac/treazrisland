import { PrismaClient, RomAssetType, SessionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const platforms = await Promise.all(
    [
      { name: 'Nintendo Entertainment System', slug: 'nes' },
      { name: 'Super Nintendo Entertainment System', slug: 'snes' },
    ].map((platform) =>
      prisma.platform.upsert({
        where: { slug: platform.slug },
        update: {},
        create: platform,
      }),
    ),
  );

  const nes = platforms.find((platform) => platform.slug === 'nes');
  const snes = platforms.find((platform) => platform.slug === 'snes');

  if (!nes || !snes) {
    throw new Error('Unable to seed platforms');
  }

  const roms = await Promise.all([
    prisma.rom.upsert({
      where: { id: 'super-mario-bros' },
      update: {},
      create: {
        id: 'super-mario-bros',
        title: 'Super Mario Bros.',
        description: 'Classic platformer featuring Mario and Luigi.',
        releaseYear: 1985,
        platformId: nes.id,
        assets: {
          create: [
            {
              type: RomAssetType.ROM,
              uri: 'https://example.com/roms/super-mario-bros.nes',
              objectKey: 'seed/roms/super-mario-bros.nes',
              checksum: 'seed-checksum-super-mario-bros-rom',
              contentType: 'application/octet-stream',
              size: 1024,
            },
            {
              type: RomAssetType.COVER,
              uri: 'https://example.com/art/super-mario-bros-cover.jpg',
              objectKey: 'seed/covers/super-mario-bros-cover.jpg',
              checksum: 'seed-checksum-super-mario-bros-cover',
              contentType: 'image/jpeg',
              size: 512,
            },
          ],
        },
      },
      include: { assets: true },
    }),
    prisma.rom.upsert({
      where: { id: 'the-legend-of-zelda-a-link-to-the-past' },
      update: {},
      create: {
        id: 'the-legend-of-zelda-a-link-to-the-past',
        title: 'The Legend of Zelda: A Link to the Past',
        description: 'Action-adventure game set in the world of Hyrule.',
        releaseYear: 1991,
        platformId: snes.id,
        assets: {
          create: [
            {
              type: RomAssetType.ROM,
              uri: 'https://example.com/roms/zelda-a-link-to-the-past.sfc',
              objectKey: 'seed/roms/zelda-a-link-to-the-past.sfc',
              checksum: 'seed-checksum-zelda-rom',
              contentType: 'application/octet-stream',
              size: 2048,
            },
            {
              type: RomAssetType.MANUAL,
              uri: 'https://example.com/manuals/zelda-a-link-to-the-past.pdf',
              objectKey: 'seed/manuals/zelda-a-link-to-the-past.pdf',
              checksum: 'seed-checksum-zelda-manual',
              contentType: 'application/pdf',
              size: 3072,
            },
          ],
        },
      },
      include: { assets: true },
    }),
  ]);

  const adminExists = (await prisma.user.count({ where: { isAdmin: true } })) > 0;

  if (!adminExists) {
    console.warn('Skipping user-facing seed data until the first admin has been bootstrapped.');
    return;
  }

  const fallbackPasswordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {
      lastLoginAt: new Date(),
      profileUpdatedAt: new Date(),
      profileCompletedAt: new Date(),
    },
    create: {
      email: 'player@example.com',
      username: 'player1',
      displayName: 'Player One',
      passwordHash: fallbackPasswordHash,
      lastLoginAt: new Date(),
      profileUpdatedAt: new Date(),
      profileCompletedAt: new Date(),
      avatarObjectKey: 'seed/avatars/player-one.png',
      avatarContentType: 'image/png',
      avatarSize: 54231,
      avatarUploadedAt: new Date(),
    },
  });

  const invite = await prisma.invite.upsert({
    where: { code: 'WELCOME-2024' },
    update: {},
    create: {
      code: 'WELCOME-2024',
      createdBy: {
        connect: { id: user.id },
      },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const session = await prisma.session.upsert({
    where: { sessionToken: 'session-token-1' },
    update: {
      status: SessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
    create: {
      userId: user.id,
      sessionToken: 'session-token-1',
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
      label: 'World 1-1',
      objectKey: 'seed/save-states/super-mario-bros-slot-0',
      checksum: 'seed-checksum-save-state-1',
      contentType: 'application/octet-stream',
      size: Buffer.from('sample-state-data').byteLength,
    },
    create: {
      userId: user.id,
      romId: roms[0].id,
      slot: 0,
      label: 'World 1-1',
      objectKey: 'seed/save-states/super-mario-bros-slot-0',
      checksum: 'seed-checksum-save-state-1',
      contentType: 'application/octet-stream',
      size: Buffer.from('sample-state-data').byteLength,
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

  console.log('Seed completed', {
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
    console.error('Failed to seed database', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
