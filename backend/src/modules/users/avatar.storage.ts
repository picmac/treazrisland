import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Client } from 'minio';

import { createMinioClient, ensureBucket } from '../roms/storage';

import type { Env } from '../../config/env';

export type AvatarUploadInput = {
  userId: string;
  filename: string;
  contentType: string;
  size: number;
};

export type AvatarUploadGrant = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
};

export interface AvatarStorage {
  createUploadGrant(input: AvatarUploadInput): Promise<AvatarUploadGrant>;
  getSignedAvatarUrl(objectKey: string): Promise<string>;
}

class S3AvatarStorage implements AvatarStorage {
  private bucketEnsured = false;

  constructor(
    private readonly client: Client,
    private readonly options: { bucket: string; region: string; presignedTtlSeconds: number },
  ) {}

  async createUploadGrant(input: AvatarUploadInput): Promise<AvatarUploadGrant> {
    await this.ensureBucket();

    const normalizedContentType = input.contentType || 'application/octet-stream';
    const objectKey = this.buildObjectKey(input.userId, input.filename);

    try {
      const uploadUrl = await this.client.presignedPutObject(
        this.options.bucket,
        objectKey,
        this.options.presignedTtlSeconds,
        {
          'Content-Type': normalizedContentType,
        },
      );

      return {
        objectKey,
        uploadUrl,
        headers: { 'Content-Type': normalizedContentType },
      };
    } catch (error) {
      throw new Error('Unable to generate avatar upload URL', { cause: error });
    }
  }

  async getSignedAvatarUrl(objectKey: string): Promise<string> {
    await this.ensureBucket();

    try {
      return await this.client.presignedGetObject(
        this.options.bucket,
        objectKey,
        this.options.presignedTtlSeconds,
      );
    } catch (error) {
      throw new Error('Unable to generate avatar download URL', { cause: error });
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }

    await ensureBucket(this.client, this.options.bucket, this.options.region);
    this.bucketEnsured = true;
  }

  private buildObjectKey(userId: string, filename: string): string {
    const sanitizedName = this.sanitizeFilename(filename);
    return `avatars/${userId}/${randomUUID()}-${sanitizedName}`;
  }

  private sanitizeFilename(filename: string): string {
    const baseName = filename.trim().replace(/\s+/g, '-');
    const stripped = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const normalized = stripped.length > 0 ? stripped : 'avatar';
    const extension = path.extname(normalized);
    const stem = extension.length > 0 ? normalized.slice(0, -extension.length) : normalized;

    const safeStem = stem.slice(-64) || 'avatar';
    const safeExt = extension.slice(0, 10);

    return `${safeStem}${safeExt}`;
  }
}

export const createAvatarStorage = (env: Env): AvatarStorage =>
  new S3AvatarStorage(createMinioClient(env), {
    bucket: env.OBJECT_STORAGE_BUCKET,
    region: env.OBJECT_STORAGE_REGION,
    presignedTtlSeconds: env.OBJECT_STORAGE_PRESIGNED_TTL,
  });
