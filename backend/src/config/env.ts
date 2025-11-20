import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

loadEnvFiles({ silent: true });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),
  MAGIC_LINK_TOKEN_TTL: z.coerce.number().int().positive().default(300),
  DATABASE_URL: z.string().url(),
  SHADOW_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().min(1),
  OBJECT_STORAGE_PORT: z.coerce.number().int().min(1).max(65535),
  OBJECT_STORAGE_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1),
  OBJECT_STORAGE_BUCKET: z.string().min(1),
  OBJECT_STORAGE_REGION: z.string().min(1).default('us-east-1'),
  OBJECT_STORAGE_PRESIGNED_TTL: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = envSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    PORT: source.PORT,
    LOG_LEVEL: source.LOG_LEVEL,
    JWT_SECRET: source.JWT_SECRET,
    JWT_ACCESS_TOKEN_TTL: source.JWT_ACCESS_TOKEN_TTL,
    JWT_REFRESH_TOKEN_TTL: source.JWT_REFRESH_TOKEN_TTL,
    MAGIC_LINK_TOKEN_TTL: source.MAGIC_LINK_TOKEN_TTL,
    DATABASE_URL: source.DATABASE_URL,
    SHADOW_DATABASE_URL: source.SHADOW_DATABASE_URL,
    REDIS_URL: source.REDIS_URL,
    OBJECT_STORAGE_ENDPOINT: source.OBJECT_STORAGE_ENDPOINT,
    OBJECT_STORAGE_PORT: source.OBJECT_STORAGE_PORT,
    OBJECT_STORAGE_USE_SSL: source.OBJECT_STORAGE_USE_SSL,
    OBJECT_STORAGE_ACCESS_KEY: source.OBJECT_STORAGE_ACCESS_KEY,
    OBJECT_STORAGE_SECRET_KEY: source.OBJECT_STORAGE_SECRET_KEY,
    OBJECT_STORAGE_BUCKET: source.OBJECT_STORAGE_BUCKET,
    OBJECT_STORAGE_REGION: source.OBJECT_STORAGE_REGION,
    OBJECT_STORAGE_PRESIGNED_TTL: source.OBJECT_STORAGE_PRESIGNED_TTL,
  });

  if (!result.success) {
    throw new Error('Invalid environment configuration', { cause: result.error });
  }

  return result.data;
};

let cachedEnv: Env | null = null;

export const getEnv = (): Env => {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }

  return cachedEnv;
};
