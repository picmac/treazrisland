import { createHash, randomUUID } from 'node:crypto';

import {
  RomStorageError,
  type RomStorage,
  type RomStorageUploadInput,
  type RomStorageUploadedAsset,
} from '../../src/modules/roms/storage';

export class TestRomStorage implements RomStorage {
  private readonly objects = new Map<
    string,
    { data: Buffer; checksum: string; contentType: string }
  >();

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
}
