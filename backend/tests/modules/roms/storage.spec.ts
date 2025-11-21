import { createHash } from 'node:crypto';

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

  describe('uploadAsset', () => {
    const buildStorage = () => {
      const bucketExists = vi.fn().mockResolvedValue(true);
      const makeBucket = vi.fn().mockResolvedValue(undefined);
      const putObject = vi.fn().mockResolvedValue(undefined);

      const storage = new S3RomStorage(
        { bucketExists, makeBucket, putObject } as unknown as ConstructorParameters<typeof S3RomStorage>[0],
        {
          bucket: 'roms',
          region: 'us-east-1',
          presignedTtlSeconds: 900,
          s3Client: {} as never,
        },
      );

      return { storage, bucketExists, makeBucket, putObject };
    };

    it('rejects empty uploads before contacting storage', async () => {
      const { storage, putObject } = buildStorage();

      await expect(
        storage.uploadAsset({
          filename: 'empty.smc',
          contentType: 'application/octet-stream',
          data: '',
          checksum: '0'.repeat(64),
        }),
      ).rejects.toThrow('Asset data cannot be empty');

      expect(putObject).not.toHaveBeenCalled();
    });

    it('validates the checksum before uploading', async () => {
      const { storage, putObject } = buildStorage();
      const data = Buffer.from('retro-rom-bytes').toString('base64');

      await expect(
        storage.uploadAsset({
          filename: 'bad-checksum.smc',
          contentType: 'application/octet-stream',
          data,
          checksum: 'f'.repeat(64),
        }),
      ).rejects.toThrow('Checksum mismatch');

      expect(putObject).not.toHaveBeenCalled();
    });

    it('uploads valid ROM assets and normalizes directories', async () => {
      const { storage, bucketExists, makeBucket, putObject } = buildStorage();
      bucketExists.mockResolvedValueOnce(false).mockResolvedValue(true);

      const payload = Buffer.from('great rom contents');
      const checksum = createHash('sha256').update(payload).digest('hex');

      const uploaded = await storage.uploadAsset({
        filename: 'demo.smc',
        contentType: 'application/octet-stream',
        data: payload.toString('base64'),
        checksum,
        directory: '/custom/roms/',
      });

      expect(bucketExists).toHaveBeenCalledWith('roms');
      expect(makeBucket).toHaveBeenCalledWith('roms', 'us-east-1');
      expect(uploaded.objectKey).toMatch(/^custom\/roms\/.+demo\.smc$/);
      expect(uploaded.uri).toBe(`s3://roms/${uploaded.objectKey}`);
      expect(uploaded.size).toBe(payload.length);
      expect(uploaded.checksum).toBe(checksum);
      expect(putObject).toHaveBeenCalledWith(
        'roms',
        uploaded.objectKey,
        expect.any(Buffer),
        payload.length,
        {
          'Content-Type': 'application/octet-stream',
        },
      );
    });
  });
});
