import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Client } from 'minio';

import type { Env } from '../../config/env';

export interface RomStorageUploadInput {
  filename: string;
  contentType: string;
  data: string;
  checksum: string;
  directory?: string;
}

export interface RomStorageUploadedAsset {
  objectKey: string;
  uri: string;
  checksum: string;
  contentType: string;
  size: number;
}

export interface RomStorageUploadGrantInput {
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  directory?: string;
}

export interface RomStorageUploadGrant {
  uploadUrl: string;
  objectKey: string;
  headers?: Record<string, string>;
}

export interface RomStorageAssetMetadata {
  size: number;
  contentType?: string;
  checksum?: string;
}

export interface RomStorage {
  uploadAsset(input: RomStorageUploadInput): Promise<RomStorageUploadedAsset>;
  createUploadGrant(input: RomStorageUploadGrantInput): Promise<RomStorageUploadGrant>;
  describeAsset(objectKey: string): Promise<RomStorageAssetMetadata>;
  getSignedAssetUrl(objectKey: string): Promise<string>;
  downloadAsset(objectKey: string): Promise<Buffer>;
  verifyChecksum(objectKey: string, expectedChecksum: string): Promise<boolean>;
  deleteAsset(objectKey: string): Promise<void>;
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
  private readonly presignPutObject: (
    command: PutObjectCommand,
    expiresInSeconds: number,
  ) => Promise<string>;

  constructor(
    private readonly client: Client,
    private readonly options: {
      bucket: string;
      region: string;
      presignedTtlSeconds: number;
      s3Client: S3Client;
      presign?: (command: PutObjectCommand, expiresInSeconds: number) => Promise<string>;
    },
  ) {
    this.presignPutObject =
      options.presign ??
      ((command, expiresInSeconds) =>
        getSignedUrl(options.s3Client, command, { expiresIn: expiresInSeconds }));
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

    await this.ensureBucket();

    const directory = this.normalizeDirectory(input.directory);
    const objectKey = `${directory}/${randomUUID()}-${input.filename}`;

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

  async createUploadGrant(input: RomStorageUploadGrantInput): Promise<RomStorageUploadGrant> {
    await this.ensureBucket();

    const directory = this.normalizeDirectory(input.directory);
    const objectKey = `${directory}/${randomUUID()}-${input.filename}`;

    try {
      const uploadUrl = await this.presignPutObject(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: objectKey,
          ContentType: input.contentType,
          Metadata: {
            checksum: input.checksum,
            size: input.size.toString(),
          },
        }),
        this.options.presignedTtlSeconds,
      );

      return {
        uploadUrl,
        objectKey,
        headers: {
          'Content-Type': input.contentType,
          'x-amz-meta-checksum': input.checksum,
          'x-amz-meta-size': input.size.toString(),
        },
      };
    } catch (error) {
      throw new RomStorageError('Unable to generate upload grant', 502, { cause: error });
    }
  }

  async describeAsset(objectKey: string): Promise<RomStorageAssetMetadata> {
    await this.ensureBucket();

    try {
      const stat = await this.client.statObject(this.options.bucket, objectKey);

      const metadata = stat.metaData ?? {};

      const checksum =
        metadata['x-amz-meta-checksum'] || metadata['checksum'] || metadata['X-Amz-Meta-Checksum'];

      const contentType =
        metadata['content-type'] || metadata['Content-Type'] || metadata['contenttype'];

      return {
        size: stat.size,
        contentType: contentType ?? undefined,
        checksum: typeof checksum === 'string' ? checksum : undefined,
      };
    } catch (error) {
      throw new RomStorageError('Unable to locate uploaded ROM asset', 404, { cause: error });
    }
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

  async downloadAsset(objectKey: string): Promise<Buffer> {
    await this.ensureBucket();

    try {
      const stream = (await this.client.getObject(this.options.bucket, objectKey)) as Readable;

      return await streamToBuffer(stream);
    } catch (error) {
      throw new RomStorageError('Unable to download ROM asset', 502, { cause: error });
    }
  }

  async verifyChecksum(objectKey: string, expectedChecksum: string): Promise<boolean> {
    const normalized = expectedChecksum.toLowerCase();
    const buffer = await this.downloadAsset(objectKey);
    const checksum = createHash('sha256').update(buffer).digest('hex');

    return checksum === normalized;
  }

  async deleteAsset(objectKey: string): Promise<void> {
    await this.ensureBucket();

    try {
      await this.client.removeObject(this.options.bucket, objectKey);
    } catch (error) {
      throw new RomStorageError('Unable to delete ROM asset', 502, { cause: error });
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

  private normalizeDirectory(directory?: string): string {
    const normalized = (directory ?? 'roms').replace(/^\/+|\/+$/g, '');
    return normalized.length > 0 ? normalized : 'roms';
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

const buildEndpoint = (host: string, port: number, useSsl: boolean) =>
  `${useSsl ? 'https' : 'http'}://${host}:${port}`;

export const createS3Client = (env: Env, hostOverride?: string, portOverride?: number): S3Client =>
  new S3Client({
    region: env.OBJECT_STORAGE_REGION,
    endpoint: buildEndpoint(
      hostOverride ?? env.OBJECT_STORAGE_ENDPOINT,
      portOverride ?? env.OBJECT_STORAGE_PORT,
      env.OBJECT_STORAGE_USE_SSL,
    ),
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_KEY,
    },
  });

export const createRomStorage = (env: Env): RomStorage => {
  const presignHost = env.OBJECT_STORAGE_PUBLIC_HOST || env.OBJECT_STORAGE_ENDPOINT;
  const presignPort = env.OBJECT_STORAGE_PUBLIC_PORT || env.OBJECT_STORAGE_PORT;
  const presignClient = createS3Client(env, presignHost, presignPort);

  return new S3RomStorage(createMinioClient(env), {
    bucket: env.OBJECT_STORAGE_BUCKET,
    region: env.OBJECT_STORAGE_REGION,
    presignedTtlSeconds: env.OBJECT_STORAGE_PRESIGNED_TTL,
    s3Client: createS3Client(env),
    presign: (command, expiresInSeconds) =>
      getSignedUrl(presignClient, command, { expiresIn: expiresInSeconds }),
  });
};

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

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};
