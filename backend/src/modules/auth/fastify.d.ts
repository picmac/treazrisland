/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from '@prisma/client';

import { RedisSessionStore } from './session-store';
import { PrismaSessionService } from '../../auth/session.service';

import type { AuthMailer } from './mailer';
import type { AuthUser } from './types';
import type { Env } from '../../config/env';
import type { PrismaInviteStore } from '../invites/invite.store';
import type { RomService } from '../roms/rom.service';
import type { SaveStateService } from '../roms/save-state.service';
import type { RomStorage } from '../roms/storage';
import type { AvatarStorage } from '../users/avatar.storage';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    prisma: PrismaClient;
    redis: Redis;
    sessionStore: RedisSessionStore;
    sessionService: PrismaSessionService;
    romStorage: RomStorage;
    romService: RomService;
    saveStateService: SaveStateService;
    inviteStore: PrismaInviteStore;
    authMailer: AuthMailer;
    avatarStorage: AvatarStorage;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorizeAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthUser;
  }
}
