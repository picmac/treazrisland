import { PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import { S3RomStorage } from '../../../src/modules/roms/storage';

describe('S3RomStorage', () => {
  const bucketExists = vi.fn().mockResolvedValue(true);
  const presign = vi.fn().mockResolvedValue('https://storage/upload');

  const storage = new S3RomStorage(
    { bucketExists } as unknown as ConstructorParameters<typeof S3RomStorage>[0],
    {
      bucket: 'roms',
      region: 'us-east-1',
      presignedTtlSeconds: 900,
      s3Client: {} as never,
      presign,
    },
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
    expect(presign).toHaveBeenCalledWith(expect.any(PutObjectCommand), 900);

    const [command] = presign.mock.calls[0];
    const { Metadata, ContentType } = (command as PutObjectCommand).input;

    expect(ContentType).toBe('application/octet-stream');
    expect(Metadata).toEqual({ checksum, size: '1024' });
    expect(grant.headers).toEqual({
      'Content-Type': 'application/octet-stream',
      'x-amz-meta-checksum': checksum,
      'x-amz-meta-size': '1024',
    });
  });
});
