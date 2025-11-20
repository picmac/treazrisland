import type { AvatarStorage } from './avatar.storage';

declare module 'fastify' {
  interface FastifyInstance {
    avatarStorage: AvatarStorage;
  }
}
