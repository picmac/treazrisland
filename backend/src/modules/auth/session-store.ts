import type { AuthUser, MagicLinkSession } from './types';
import type { Redis } from 'ioredis';


type RedisCompatibleClient = Pick<Redis, 'get' | 'set' | 'del'>;

export class RedisSessionStore {
  private readonly refreshPrefix = 'auth:refresh:';

  private readonly magicLinkPrefix = 'auth:magic:';

  constructor(
    private readonly client: RedisCompatibleClient,
    private readonly config: {
      refreshTokenTtlSeconds: number;
      magicLinkTokenTtlSeconds: number;
    },
  ) {}

  async createRefreshSession(sessionId: string, user: AuthUser): Promise<void> {
    await this.client.set(
      this.refreshPrefix + sessionId,
      JSON.stringify({ user }),
      'EX',
      this.config.refreshTokenTtlSeconds,
    );
  }

  async renewRefreshSession(sessionId: string, user: AuthUser): Promise<void> {
    await this.createRefreshSession(sessionId, user);
  }

  async getRefreshSession(sessionId: string): Promise<AuthUser | null> {
    const payload = await this.client.get(this.refreshPrefix + sessionId);

    if (!payload) {
      return null;
    }

    try {
      const data = JSON.parse(payload) as MagicLinkSession;
      return data.user;
    } catch (error) {
      return null;
    }
  }

  async deleteRefreshSession(sessionId: string): Promise<void> {
    await this.client.del(this.refreshPrefix + sessionId);
  }

  async saveMagicLinkToken(token: string, user: AuthUser): Promise<void> {
    await this.client.set(
      this.magicLinkPrefix + token,
      JSON.stringify({ user }),
      'EX',
      this.config.magicLinkTokenTtlSeconds,
    );
  }

  async consumeMagicLinkToken(token: string): Promise<AuthUser | null> {
    const key = this.magicLinkPrefix + token;
    const payload = await this.client.get(key);

    if (!payload) {
      return null;
    }

    await this.client.del(key);

    try {
      const data = JSON.parse(payload) as MagicLinkSession;
      return data.user;
    } catch (error) {
      return null;
    }
  }
}
