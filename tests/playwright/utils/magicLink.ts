import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const MAGIC_LINK_PREFIX = 'auth:magic:';
const DEFAULT_TTL_SECONDS = Number(process.env.PLAYWRIGHT_MAGIC_LINK_TTL ?? 300);
const redisUrl =
  process.env.PLAYWRIGHT_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/0';

export interface MagicLinkUserSeed {
  id: string;
  email: string;
}

export async function seedMagicLinkToken(
  user: MagicLinkUserSeed,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  providedToken?: string,
): Promise<string> {
  const redis = new Redis(redisUrl);
  const token = providedToken ?? randomUUID();

  try {
    await redis.set(MAGIC_LINK_PREFIX + token, JSON.stringify({ user }), 'EX', ttlSeconds);
  } finally {
    await redis.quit();
  }

  return token;
}
