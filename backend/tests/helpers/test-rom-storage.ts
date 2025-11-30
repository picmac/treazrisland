import { createHash, randomUUID } from 'node:crypto';

import {
  RomStorageError,
  type RomStorage,
  type RomStorageAssetMetadata,
  type RomStorageUploadGrant,
  type RomStorageUploadInput,
  type RomStorageUploadedAsset,
} from '../../src/modules/roms/storage';

export class TestRomStorage implements RomStorage {
  private readonly objects = new Map<
    string,
    { data: Buffer; checksum: string; contentType: string }
  >();

  stageUploadedAsset(
    filename: string,
    data: Buffer,
    contentType: string,
  ): { objectKey: string; checksum: string; size: number } {
    const checksum = createHash('sha256').update(data).digest('hex');
    const objectKey = `roms/${randomUUID()}-${filename}`;
    this.objects.set(objectKey, { data, checksum, contentType });

    return { objectKey, checksum, size: data.length };
  }

  async uploadAsset(input: RomStorageUploadInput): Promise<RomStorageUploadedAsset> {
    let buffer: Buffer;

    try {
      buffer = Buffer.from(input.data, 'base64');
    } catch {
      throw new RomStorageError('Asset data must be base64-encoded');
    }

    if (!buffer.length) {
      throw new RomStorageError('Asset data cannot be empty');
    }

    const checksum = createHash('sha256').update(buffer).digest('hex');

    if (checksum !== input.checksum.toLowerCase()) {
      throw new RomStorageError('Checksum mismatch');
    }

    const objectKey = `roms/${randomUUID()}-${input.filename}`;
    this.objects.set(objectKey, { data: buffer, checksum, contentType: input.contentType });

    return {
      objectKey,
      uri: `s3://test-bucket/${objectKey}`,
      checksum,
      contentType: input.contentType,
      size: buffer.length,
    };
  }

  async createUploadGrant(input: {
    filename: string;
    contentType: string;
    size: number;
    checksum: string;
  }): Promise<RomStorageUploadGrant> {
    const objectKey = `roms/${randomUUID()}-${input.filename}`;
    this.objects.set(objectKey, {
      data: Buffer.alloc(input.size),
      checksum: input.checksum,
      contentType: input.contentType,
    });

    return {
      uploadUrl: `https://mock-rom-storage/${objectKey}`,
      objectKey,
      headers: {
        'Content-Type': input.contentType,
        'x-amz-meta-checksum': input.checksum,
        'x-amz-meta-size': input.size.toString(),
      },
    };
  }

  async describeAsset(objectKey: string): Promise<RomStorageAssetMetadata> {
    const object = this.objects.get(objectKey);

    if (!object) {
      throw new RomStorageError('Asset not found', 404);
    }

    return {
      size: object.data.length,
      contentType: object.contentType,
      checksum: object.checksum,
    };
  }

  async getSignedAssetUrl(objectKey: string): Promise<string> {
    if (!this.objects.has(objectKey)) {
      throw new RomStorageError('Asset not found');
    }

    const encodedKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://mock-rom-storage/${encodedKey}`;
  }

  async downloadAsset(objectKey: string): Promise<Buffer> {
    const object = this.objects.get(objectKey);

    if (!object) {
      throw new RomStorageError('Asset not found');
    }

    return Buffer.from(object.data);
  }

  async verifyChecksum(objectKey: string, expectedChecksum: string): Promise<boolean> {
    const object = this.objects.get(objectKey);

    if (!object) {
      throw new RomStorageError('Asset not found');
    }

    return object.checksum === expectedChecksum.toLowerCase();
  }

  async deleteAsset(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }
}
