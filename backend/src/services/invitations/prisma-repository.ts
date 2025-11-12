import type { PrismaClient } from '@prisma/client';

import type {
  CreateInvitationRecord,
  InvitationRecord,
  InvitationRepository,
  FindInvitationQuery,
} from './types';

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: CreateInvitationRecord): Promise<InvitationRecord> {
    const created = await this.prisma.invite.create({
      data: {
        email: record.email,
        code: record.tokenHash,
        createdById: record.createdById,
        expiresAt: record.expiresAt,
      },
    });

    return {
      id: created.id,
      email: created.email ?? '',
      tokenHash: created.code,
      createdAt: created.createdAt,
      createdById: created.createdById ?? null,
      expiresAt: created.expiresAt ?? null,
    };
  }

  async findLatest(query: FindInvitationQuery): Promise<InvitationRecord | null> {
    const latest = await this.prisma.invite.findFirst({
      where: { email: query.email },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return null;
    }

    return {
      id: latest.id,
      email: latest.email ?? '',
      tokenHash: latest.code,
      createdAt: latest.createdAt,
      createdById: latest.createdById ?? null,
      expiresAt: latest.expiresAt ?? null,
    };
  }
}
