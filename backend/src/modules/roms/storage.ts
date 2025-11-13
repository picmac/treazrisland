import { Client } from 'minio';

import type { Env } from '../../config/env';

export const createMinioClient = (env: Env): Client =>
  new Client({
    endPoint: env.OBJECT_STORAGE_ENDPOINT,
    port: env.OBJECT_STORAGE_PORT,
    useSSL: env.OBJECT_STORAGE_USE_SSL,
    accessKey: env.OBJECT_STORAGE_ACCESS_KEY,
    secretKey: env.OBJECT_STORAGE_SECRET_KEY,
    region: env.OBJECT_STORAGE_REGION,
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
