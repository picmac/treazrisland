import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StorageSignedUrlResult, StorageStreamResult } from "./storage.js";
import { StorageService, safeUnlink } from "./storage.js";

export type PlayStateUploadParams = {
  userId: string;
  romId: string;
  playStateId?: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string | undefined>;
};

export type PlayStateUploadResult = {
  playStateId: string;
  storageKey: string;
  size: number;
  checksumSha256: string;
};

export class PlayStateStorageService {
  constructor(private readonly storage: StorageService) {}

  buildStorageKey(userId: string, romId: string, playStateId: string): string {
    if (!userId) {
      throw new Error("userId is required to build a play-state storage key");
    }
    if (!romId) {
      throw new Error("romId is required to build a play-state storage key");
    }
    if (!playStateId) {
      throw new Error(
        "playStateId is required to build a play-state storage key",
      );
    }

    return `play-states/${userId}/${romId}/${playStateId}.bin`;
  }

  async uploadFromBuffer(params: PlayStateUploadParams): Promise<PlayStateUploadResult> {
    const { userId, romId, contentType, metadata } = params;
    const playStateId = params.playStateId ?? randomUUID();
    const storageKey = this.buildStorageKey(userId, romId, playStateId);
    const buffer = params.buffer;
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("buffer must be a Node.js Buffer instance");
    }

    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
    const tempPath = join(
      tmpdir(),
      `treaz-play-state-${playStateId}-${Date.now()}.bin`,
    );
    await writeFile(tempPath, buffer);

    try {
      await this.storage.putObject(this.storage.assetBucket, storageKey, {
        filePath: tempPath,
        size: buffer.byteLength,
        sha256: checksumSha256,
        contentType: contentType ?? "application/octet-stream",
        metadata,
      });
    } finally {
      await safeUnlink(tempPath).catch(() => {});
    }

    return {
      playStateId,
      storageKey,
      size: buffer.byteLength,
      checksumSha256,
    };
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey) {
      return;
    }
    await this.storage.deleteAssetObject(storageKey);
  }

  async getSignedUrl(
    storageKey: string,
    options: { expiresInSeconds?: number } = {},
  ): Promise<StorageSignedUrlResult | null> {
    return this.storage.getAssetObjectSignedUrl(storageKey, options);
  }

  async getStream(storageKey: string): Promise<StorageStreamResult> {
    return this.storage.getAssetObjectStream(storageKey);
  }
}

