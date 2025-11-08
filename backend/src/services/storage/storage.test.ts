import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, stat, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { StorageService } from "./storage.js";

const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function buildPngBuffer(size = 64): Buffer {
  const payload = Buffer.alloc(Math.max(0, size - PNG_HEADER.length), 1);
  return Buffer.concat([PNG_HEADER, payload]);
}

describe("StorageService avatar uploads", () => {
  let tempRoot: string;
  let service: StorageService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "storage-avatar-test-"));
    service = new StorageService({
      driver: "filesystem",
      localRoot: tempRoot,
      assetBucket: "assets",
      romBucket: "roms",
      biosBucket: "bios",
      forcePathStyle: true,
    });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("stores avatar uploads and returns metadata", async () => {
    const buffer = buildPngBuffer(128);
    const stream = Readable.from(buffer);

    const result = await service.uploadUserAvatar({
      userId: "user_1",
      stream,
      maxBytes: 512,
      contentType: "image/png",
    });

    expect(result.storageKey).toMatch(/^avatars\/user_1\//);
    expect(result.size).toBe(buffer.length);
    expect(result.contentType).toBe("image/png");
    expect(result.checksumSha256).toHaveLength(64);

    const destPath = join(tempRoot, service.assetBucket, result.storageKey);
    const stats = await stat(destPath);
    expect(stats.isFile()).toBe(true);
  });

  it("rejects unsupported avatar formats", async () => {
    const buffer = Buffer.from("not-an-image");
    const stream = Readable.from(buffer);

    await expect(
      service.uploadUserAvatar({
        userId: "user_1",
        stream,
        maxBytes: 512,
        contentType: "application/octet-stream",
      }),
    ).rejects.toThrow(/Unsupported avatar format/);
  });

  it("enforces size limits and avoids persisting oversized avatars", async () => {
    const buffer = buildPngBuffer(1024);
    const stream = Readable.from(buffer);

    await expect(
      service.uploadUserAvatar({
        userId: "user_1",
        stream,
        maxBytes: 256,
        contentType: "image/png",
      }),
    ).rejects.toThrow(/Avatar exceeds maximum size/);

    const assetDir = join(tempRoot, service.assetBucket, "avatars", "user_1");
    let entries: string[] = [];
    try {
      entries = await readdir(assetDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        entries = [];
      } else {
        throw error;
      }
    }
    expect(entries.length).toBe(0);
  });
});

describe("StorageService filesystem hardening", () => {
  let tempRoot: string;
  let service: StorageService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "storage-security-test-"));
    service = new StorageService({
      driver: "filesystem",
      localRoot: tempRoot,
      assetBucket: "assets",
      romBucket: "roms",
      biosBucket: "bios",
      forcePathStyle: true
    });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("rejects keys that resolve outside the storage root", async () => {
    const sourcePath = join(tempRoot, "payload.bin");
    await writeFile(sourcePath, Buffer.from("payload"));

    await expect(
      service.putObject(service.assetBucket, "../outside", {
        filePath: sourcePath,
        size: 7,
        sha256: "deadbeef"
      })
    ).rejects.toThrow(/outside the configured storage root/);
  });

  it("prevents read access to paths outside the storage root", async () => {
    await expect(
      service.getObjectStream(service.assetBucket, "../../../../etc/passwd")
    ).rejects.toThrow(/outside the configured storage root/);
  });

  it("prevents deleting files outside the storage root", async () => {
    await expect(
      service.deleteObject(service.assetBucket, "../outside-file")
    ).rejects.toThrow(/outside the configured storage root/);
  });
});
