#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient, RomUploadKind } from "@prisma/client";
import { env } from "../../src/config/env.js";
import { StorageService } from "../../src/services/storage/storage.js";

const prisma = new PrismaClient();

const DEFAULT_RETENTION_DAYS = 90;
const batchSize = Number.parseInt(
  process.env.ROM_UPLOAD_RETENTION_BATCH ?? "100",
  10,
);
const retentionDays = Number.parseInt(
  process.env.ROM_UPLOAD_RETENTION_DAYS ?? `${DEFAULT_RETENTION_DAYS}`,
  10,
);

if (Number.isNaN(retentionDays) || retentionDays <= 0) {
  throw new Error(
    `ROM_UPLOAD_RETENTION_DAYS must be a positive integer (received: ${process.env.ROM_UPLOAD_RETENTION_DAYS})`,
  );
}

function createStorageService(): StorageService {
  const common = {
    assetBucket: env.STORAGE_BUCKET_ASSETS,
    romBucket: env.STORAGE_BUCKET_ROMS,
    biosBucket: env.STORAGE_BUCKET_BIOS,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    signedUrlTTLSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS,
  } as const;

  if (env.STORAGE_DRIVER === "filesystem") {
    const localRoot =
      env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), "var", "storage");
    return new StorageService({
      ...common,
      driver: "filesystem",
      localRoot,
    });
  }

  return new StorageService({
    ...common,
    driver: "s3",
    endpoint: env.STORAGE_ENDPOINT!,
    region: env.STORAGE_REGION!,
    accessKey: env.STORAGE_ACCESS_KEY!,
    secretKey: env.STORAGE_SECRET_KEY!,
  });
}

const storage = createStorageService();

async function ensureFilesystemRoot(): Promise<void> {
  if (env.STORAGE_DRIVER !== "filesystem") {
    return;
  }

  const localRoot = env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), "var", "storage");
  await mkdir(localRoot, { recursive: true });
}

function resolveBucket(kind: RomUploadKind): string {
  if (kind === RomUploadKind.BIOS) {
    if (!env.STORAGE_BUCKET_BIOS) {
      throw new Error("BIOS bucket is not configured but BIOS uploads exist");
    }
    return env.STORAGE_BUCKET_BIOS;
  }

  return env.STORAGE_BUCKET_ROMS;
}

async function pruneOlderThan(): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;

  while (true) {
    const audits = await prisma.romUploadAudit.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, kind: true, storageKey: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });

    if (audits.length === 0) {
      break;
    }

    for (const audit of audits) {
      try {
        const bucket = resolveBucket(audit.kind);
        await storage.deleteObject(bucket, audit.storageKey);
      } catch (error) {
        console.warn(
          `Failed to delete storage object for audit ${audit.id}: ${(error as Error).message}`,
        );
      }

      await prisma.romUploadAudit.delete({ where: { id: audit.id } });
      totalDeleted += 1;
    }
  }

  return totalDeleted;
}

async function main() {
  await ensureFilesystemRoot();
  const deleted = await pruneOlderThan();
  console.log(
    `Pruned ${deleted} rom upload audit records older than ${retentionDays} days`,
  );
}

await main()
  .catch((error) => {
    console.error(`Retention pruning failed: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
