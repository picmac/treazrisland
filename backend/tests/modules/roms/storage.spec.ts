import { describe, expect, it, vi } from 'vitest';

import { S3RomStorage } from '../../../src/modules/roms/storage';

describe('S3RomStorage', () => {
  const bucketExists = vi.fn().mockResolvedValue(true);
  const presignedPutObject = vi.fn().mockResolvedValue('https://storage/upload');

  const storage = new S3RomStorage(
    {
      bucketExists,
      presignedPutObject,
    } as unknown as ConstructorParameters<typeof S3RomStorage>[0],
    { bucket: 'roms', region: 'us-east-1', presignedTtlSeconds: 900 },
  );

  it('signs presigned uploads with checksum and size metadata', async () => {
    const checksum = 'a'.repeat(64);
    const grant = await storage.createUploadGrant({
      filename: 'test.smc',
      contentType: 'application/octet-stream',
      size: 1024,
      checksum,
    });

    expect(bucketExists).toHaveBeenCalledWith('roms');
    expect(presignedPutObject).toHaveBeenCalledWith('roms', expect.any(String), 900, {
      'Content-Type': 'application/octet-stream',
      'x-amz-meta-checksum': checksum,
      'x-amz-meta-size': '1024',
    });
    expect(grant.headers).toEqual({
      'Content-Type': 'application/octet-stream',
      'x-amz-meta-checksum': checksum,
      'x-amz-meta-size': '1024',
    });
  });
});
