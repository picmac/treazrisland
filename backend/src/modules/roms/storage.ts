import { createHash, randomUUID } from 'node:crypto';

import { Client } from 'minio';

import type { Env } from '../../config/env';

export interface RomStorageUploadInput {
  filename: string;
  contentType: string;
  data: string;
  checksum: string;
}

export interface RomStorageUploadedAsset {
  objectKey: string;
  uri: string;
  checksum: string;
  contentType: string;
  size: number;
}

export interface RomStorage {
  uploadAsset(input: RomStorageUploadInput): Promise<RomStorageUploadedAsset>;
  getSignedAssetUrl(objectKey: string): Promise<string>;
}

export class RomStorageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export class S3RomStorage implements RomStorage {
  private bucketEnsured = false;

  constructor(
    private readonly client: Client,
    private readonly options: { bucket: string; region: string; presignedTtlSeconds: number },
  ) {}

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

    await this.ensureBucket();

    const objectKey = `roms/${randomUUID()}-${input.filename}`;

    try {
      await this.client.putObject(this.options.bucket, objectKey, buffer, buffer.length, {
        'Content-Type': input.contentType,
      });
    } catch (error) {
      throw new RomStorageError('Unable to upload ROM asset to storage', 502, { cause: error });
    }

    return {
      objectKey,
      uri: `s3://${this.options.bucket}/${objectKey}`,
      checksum,
      contentType: input.contentType,
      size: buffer.length,
    };
  }

  async getSignedAssetUrl(objectKey: string): Promise<string> {
    await this.ensureBucket();

    try {
      return await this.client.presignedGetObject(
        this.options.bucket,
        objectKey,
        this.options.presignedTtlSeconds,
      );
    } catch (error) {
      throw new RomStorageError('Unable to generate signed ROM URL', 502, { cause: error });
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }

    const exists = await this.client.bucketExists(this.options.bucket);

    if (!exists) {
      await this.client.makeBucket(this.options.bucket, this.options.region);
    }

    this.bucketEnsured = true;
  }
}

export const createMinioClient = (env: Env): Client =>
  new Client({
    endPoint: env.OBJECT_STORAGE_ENDPOINT,
    port: env.OBJECT_STORAGE_PORT,
    useSSL: env.OBJECT_STORAGE_USE_SSL,
    accessKey: env.OBJECT_STORAGE_ACCESS_KEY,
    secretKey: env.OBJECT_STORAGE_SECRET_KEY,
    region: env.OBJECT_STORAGE_REGION,
  });

export const createRomStorage = (env: Env): RomStorage =>
  new S3RomStorage(createMinioClient(env), {
    bucket: env.OBJECT_STORAGE_BUCKET,
    region: env.OBJECT_STORAGE_REGION,
    presignedTtlSeconds: env.OBJECT_STORAGE_PRESIGNED_TTL,
  });

export const ensureBucket = async (
  client: Client,
  bucket: string,
  region: string,
): Promise<void> => {
  const exists = await client.bucketExists(bucket);

  if (!exists) {
    await client.makeBucket(bucket, region);
  }
};
