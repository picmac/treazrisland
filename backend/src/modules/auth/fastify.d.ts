import { RedisSessionStore } from './session-store';

import type { AuthUser } from './types';
import type { Env } from '../../config/env';
import type { InMemoryInviteStore } from '../invites/invite.store';
import type { RomService } from '../roms/rom.service';
import type { SaveStateService } from '../roms/save-state.service';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    sessionStore: RedisSessionStore;
    romService: RomService;
    saveStateService: SaveStateService;
    inviteStore: InMemoryInviteStore;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthUser;
  }
}
