import type { Env } from '../../config/env';
import { RedisSessionStore } from './session-store';
import type { AuthUser } from './types';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    sessionStore: RedisSessionStore;
  }

  interface FastifyRequest {
    user: AuthUser;
  }
}
