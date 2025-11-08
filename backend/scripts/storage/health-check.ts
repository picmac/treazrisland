#!/usr/bin/env node
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UploadSource } from "../../src/services/storage/storage.js";
import { StorageService } from "../../src/services/storage/storage.js";
import { env } from "../../src/config/env.js";

function createStorageService(): StorageService {
  const common = {
    assetBucket: env.STORAGE_BUCKET_ASSETS,
    romBucket: env.STORAGE_BUCKET_ROMS,
    biosBucket: env.STORAGE_BUCKET_BIOS,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE ?? true,
    signedUrlTTLSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS
  } as const;

  if (env.STORAGE_DRIVER === "s3") {
    return new StorageService({
      ...common,
      driver: "s3",
      endpoint: env.STORAGE_ENDPOINT!,
      region: env.STORAGE_REGION!,
      accessKey: env.STORAGE_ACCESS_KEY!,
      secretKey: env.STORAGE_SECRET_KEY!,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE ?? true
    });
  }

  const localRoot = env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), "var", "storage");
  return new StorageService({
    ...common,
    driver: "filesystem",
    localRoot
  });
}

async function createProbeFile(): Promise<{ source: UploadSource; cleanup: () => Promise<void>; payload: Buffer }> {
  const dir = await mkdtemp(join(tmpdir(), "treaz-storage-health-"));
  const filePath = join(dir, `probe-${randomUUID()}.txt`);
  const payload = Buffer.from(`TREAZRISLAND storage probe @ ${new Date().toISOString()}`);
  await writeFile(filePath, payload);

  const sha256 = createHash("sha256").update(payload).digest("hex");
  return {
    payload,
    source: {
      filePath,
      size: payload.byteLength,
      sha256,
      contentType: "text/plain"
    },
    cleanup: () => rm(dir, { recursive: true, force: true })
  };
}

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

async function main() {
  const storage = createStorageService();
  const key = `health-check/${new Date().toISOString()}-${randomUUID()}.txt`;
  const { source, cleanup, payload } = await createProbeFile();

  try {
    console.log(`→ Uploading probe object to ${storage.assetBucket} (${env.STORAGE_DRIVER})`);
    await storage.putObject(storage.assetBucket, key, source);

    const signedUrl = await storage.getAssetObjectSignedUrl(key);
    if (signedUrl) {
      console.log(`→ Signed URL generated (expires ${signedUrl.expiresAt.toISOString()})`);
    } else {
      console.log("→ Signed URLs disabled for current driver; skipping check");
    }

    console.log("→ Downloading probe object");
    const result = await storage.getAssetObjectStream(key);
    const received = await readStream(result.stream);

    if (!received.equals(payload)) {
      throw new Error("Downloaded payload does not match uploaded payload");
    }

    console.log("→ Payload verified; deleting probe object");
    await storage.deleteAssetObject(key);
    console.log("✓ Storage health check succeeded");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("✗ Storage health check failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
