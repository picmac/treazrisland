import {
  PrismaClient,
  EnrichmentProvider,
  RomAssetSource,
  RomAssetType,
  RomBinaryStatus,
  Role,
} from "@prisma/client";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const prisma = new PrismaClient();

const now = () => new Date().toISOString();

function initialStepState() {
  const timestamp = now();
  return {
    "first-admin": { status: "PENDING", updatedAt: timestamp },
    "system-profile": { status: "PENDING", updatedAt: timestamp },
    integrations: { status: "PENDING", updatedAt: timestamp },
    personalization: { status: "PENDING", updatedAt: timestamp },
  };
}

async function ensureRomBinaryOnDisk(params: {
  storageRoot: string;
  romBucket: string;
  storageKey: string;
  content: Buffer;
}): Promise<{ size: number; sha256: string }>
{
  const { storageRoot, romBucket, storageKey, content } = params;
  const destination = resolve(storageRoot, romBucket, storageKey);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
  const sha256 = createHash("sha256").update(content).digest("hex");
  return { size: content.byteLength, sha256 };
}

async function resetSetupState() {
  const steps = initialStepState();
  await prisma.setupState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      setupComplete: false,
      steps,
    },
    update: {
      setupComplete: false,
      steps,
    },
  });
}

async function main(): Promise<void> {
  const fixtureConfig = {
    inviteToken: process.env.SMOKE_INVITE_TOKEN ?? "smoke-test-token",
    inviteEmail: process.env.SMOKE_INVITE_EMAIL ?? "deckhand-smoke@example.com",
    inviteId: process.env.SMOKE_INVITE_ID ?? "invite_smoke_demo",
    platformId: process.env.SMOKE_PLATFORM_ID ?? "platform_smoke",
    platformSlug: process.env.SMOKE_PLATFORM_SLUG ?? "smoke-snes",
    platformName: process.env.SMOKE_PLATFORM_NAME ?? "Smoke Test Console",
    platformShortName: process.env.SMOKE_PLATFORM_SHORT ?? "SMOKE",
    romId: process.env.SMOKE_ROM_ID ?? "rom_smoke_demo",
    romTitle: process.env.SMOKE_ROM_TITLE ?? "Smoke Test Adventure",
    romReleaseYear: Number.parseInt(process.env.SMOKE_ROM_RELEASE_YEAR ?? "1994", 10) || 1994,
    romPlayers: Number.parseInt(process.env.SMOKE_ROM_PLAYERS ?? "1", 10) || 1,
    romStorageKey:
      process.env.SMOKE_ROM_STORAGE_KEY ?? "smoke/demo-rom.txt",
    romFilename:
      process.env.SMOKE_ROM_FILENAME ?? "smoke-test-adventure.txt",
    romSummary:
      process.env.SMOKE_ROM_SUMMARY ??
      "Navigate a pixellated archipelago to recover cartridges hidden by mischievous parrots.",
    romDeveloper: process.env.SMOKE_ROM_DEVELOPER ?? "Treaz Labs QA",
    romPublisher: process.env.SMOKE_ROM_PUBLISHER ?? "Treaz Collective",
    romGenre: process.env.SMOKE_ROM_GENRE ?? "Adventure",
  } as const;

  const storageRoot = resolve(
    process.env.SMOKE_STORAGE_ROOT ?? process.env.STORAGE_LOCAL_ROOT ?? "./var/storage",
  );
  const romBucket = process.env.STORAGE_BUCKET_ROMS ?? "roms";
  const assetBucket = process.env.STORAGE_BUCKET_ASSETS ?? "assets";

  const romContent = Buffer.from(
    [
      "TREAZRISLAND SMOKE FIXTURE\n",
      "This placeholder archive ensures the smoke suite exercises storage and download paths.\n",
      "Never ship this data to production—replace it with real ROM binaries instead.\n",
    ].join(""),
    "utf8",
  );

  const { size: romSize, sha256 } = await ensureRomBinaryOnDisk({
    storageRoot,
    romBucket,
    storageKey: fixtureConfig.romStorageKey,
    content: romContent,
  });

  await prisma.$transaction(async (tx) => {
    await tx.playState.deleteMany({});
    await tx.refreshToken.deleteMany({});
    await tx.refreshTokenFamily.deleteMany({});
    await tx.loginAudit.deleteMany({});
    await tx.user.deleteMany({});
    await tx.userInvitation.deleteMany({});
    await tx.systemSetting.deleteMany({});
    await tx.romAsset.deleteMany({ where: { romId: fixtureConfig.romId } });
    await tx.romMetadata.deleteMany({ where: { romId: fixtureConfig.romId } });
    await tx.romBinary.deleteMany({ where: { romId: fixtureConfig.romId } });
    await tx.rom.deleteMany({ where: { id: fixtureConfig.romId } });
    await tx.platform.deleteMany({ where: { id: fixtureConfig.platformId } });
  });

  await resetSetupState();

  const platform = await prisma.platform.create({
    data: {
      id: fixtureConfig.platformId,
      slug: fixtureConfig.platformSlug,
      name: fixtureConfig.platformName,
      shortName: fixtureConfig.platformShortName,
      screenscraperId: null,
    },
  });

  const rom = await prisma.rom.create({
    data: {
      id: fixtureConfig.romId,
      platformId: platform.id,
      title: fixtureConfig.romTitle,
      releaseYear: fixtureConfig.romReleaseYear,
      players: fixtureConfig.romPlayers,
      romSize,
      romHash: sha256,
    },
  });

  await prisma.romBinary.create({
    data: {
      romId: rom.id,
      storageKey: fixtureConfig.romStorageKey,
      originalFilename: fixtureConfig.romFilename,
      archiveMimeType: "application/octet-stream",
      archiveSize: romSize,
      checksumSha256: sha256,
      status: RomBinaryStatus.READY,
    },
  });

  await prisma.romMetadata.create({
    data: {
      romId: rom.id,
      source: EnrichmentProvider.MANUAL,
      language: "en",
      region: "USA",
      summary: fixtureConfig.romSummary,
      developer: fixtureConfig.romDeveloper,
      publisher: fixtureConfig.romPublisher,
      genre: fixtureConfig.romGenre,
      rating: 4.5,
    },
  });

  await prisma.romAsset.create({
    data: {
      romId: rom.id,
      providerId: "smoke-demo-cover",
      type: RomAssetType.COVER,
      source: RomAssetSource.MANUAL_ENTRY,
      language: "en",
      region: "USA",
      format: "png",
      fileSize: 2048,
      checksum: createHash("sha256").update("cover").digest("hex"),
      storageKey: "seed/smoke/cover.png",
      externalUrl: "https://example.com/treaz/smoke-cover.png",
    },
  });

  const fingerprint = createHash("sha256")
    .update(fixtureConfig.inviteToken)
    .digest("hex");
  const tokenHash = await argon2.hash(fixtureConfig.inviteToken, {
    type: argon2.argon2id,
  });

  await prisma.userInvitation.create({
    data: {
      id: fixtureConfig.inviteId,
      tokenHash,
      tokenFingerprint: fingerprint,
      role: Role.USER,
      email: fixtureConfig.inviteEmail,
      expiresAt: new Date("2099-12-31T00:00:00.000Z"),
    },
  });

  await prisma.systemSetting.create({
    data: {
      key: "storage",
      value: {
        driver: "filesystem",
        localRoot: storageRoot,
        bucketAssets: assetBucket,
        bucketRoms: romBucket,
        bucketBios: process.env.STORAGE_BUCKET_BIOS ?? "bios",
      },
    },
  });

  console.log("Seeded smoke fixtures:");
  console.log(`  Platform: ${fixtureConfig.platformName} (${platform.id})`);
  console.log(`  ROM: ${fixtureConfig.romTitle} (${rom.id}) -> ${fixtureConfig.romStorageKey}`);
  console.log(`  Invitation for ${fixtureConfig.inviteEmail} with token ${fixtureConfig.inviteToken}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed smoke fixtures", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
