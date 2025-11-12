import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

loadEnvFiles({ silent: true });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),
  MAGIC_LINK_TOKEN_TTL: z.coerce.number().int().positive().default(300),
  REDIS_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = envSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    PORT: source.PORT,
    JWT_SECRET: source.JWT_SECRET,
    JWT_ACCESS_TOKEN_TTL: source.JWT_ACCESS_TOKEN_TTL,
    JWT_REFRESH_TOKEN_TTL: source.JWT_REFRESH_TOKEN_TTL,
    MAGIC_LINK_TOKEN_TTL: source.MAGIC_LINK_TOKEN_TTL,
    REDIS_URL: source.REDIS_URL,
    DATABASE_URL: source.DATABASE_URL,
  });

  if (!result.success) {
    throw new Error("Invalid environment configuration", { cause: result.error });
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
