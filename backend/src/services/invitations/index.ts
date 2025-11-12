import { PrismaClient } from '@prisma/client';

import { InMemoryInvitationRepository } from './in-memory-repository';
import { PrismaInvitationRepository } from './prisma-repository';
import { InvitationService } from './service';
import type { InvitationRepository } from './types';

let repository: InvitationRepository;

if (process.env.DATABASE_URL) {
  const prisma = new PrismaClient();
  repository = new PrismaInvitationRepository(prisma);
} else {
  repository = new InMemoryInvitationRepository();
}

export const invitationRepository = repository;
export const invitationService = new InvitationService(repository);
