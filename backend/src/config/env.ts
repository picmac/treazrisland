import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

loadEnvFiles({ silent: true });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = envSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    PORT: source.PORT,
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
