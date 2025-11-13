import type { Env } from '../../config/env';
import { RedisSessionStore } from './session-store';
import type { AuthUser } from './types';
import type { RomService } from '../roms/rom.service';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    sessionStore: RedisSessionStore;
    romService: RomService;
  }

  interface FastifyRequest {
    user: AuthUser;
  }
}
