import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient, type Invite } from '@prisma/client';

export type InviteSeed = {
  code: string;
  email?: string | null;
  createdById?: string | null;
  expiresAt?: Date | null;
  redeemedAt?: Date | null;
  redeemedById?: string | null;
};

export type InviteRecord = Invite;

const normalizeEmail = (email?: string | null): string | null => {
  if (!email) {
    return null;
  }

  return email.trim().toLowerCase();
};

const mapInviteSeed = (seed: InviteSeed) => ({
  code: seed.code,
  email: normalizeEmail(seed.email),
  createdById: seed.createdById ?? null,
  expiresAt: seed.expiresAt ?? null,
  redeemedAt: seed.redeemedAt ?? null,
  redeemedById: seed.redeemedById ?? null,
});

const INVITE_SEED_PASSWORD_HASH = 'invite-seed-placeholder-password-hash';

const deriveSeedIdentifier = (userId: string): string => {
  const normalized = userId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length >= 6) {
    return normalized.slice(0, 24);
  }

  const fallback = Buffer.from(userId).toString('hex');
  if (fallback.length > 0) {
    return (normalized + fallback).slice(0, 24);
  }

  return randomUUID().replace(/-/g, '').slice(0, 24);
};

const buildSeedUser = (userId: string) => {
  const identifier = deriveSeedIdentifier(userId);
  const username = `seed_${identifier}`.slice(0, 32);

  return {
    id: userId,
    email: `${identifier}@seed.local`,
    username,
    displayName: username,
    passwordHash: INVITE_SEED_PASSWORD_HASH,
  } satisfies Prisma.UserCreateManyInput;
};

export class PrismaInviteStore {
  constructor(private readonly prisma: PrismaClient) {}

  async reset(invites: InviteSeed[] = []): Promise<void> {
    await this.prisma.invite.deleteMany();

    if (invites.length === 0) {
      return;
    }

    await this.ensureReferencedUsers(invites);

    await this.prisma.invite.createMany({
      data: invites.map(mapInviteSeed),
      skipDuplicates: true,
    });
  }

  private async ensureReferencedUsers(invites: InviteSeed[]): Promise<void> {
    const referencedUserIds = new Set<string>();

    for (const invite of invites) {
      if (invite.createdById) {
        referencedUserIds.add(invite.createdById);
      }

      if (invite.redeemedById) {
        referencedUserIds.add(invite.redeemedById);
      }
    }

    if (referencedUserIds.size === 0) {
      return;
    }

    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: Array.from(referencedUserIds) } },
      select: { id: true },
    });

    const existingIds = new Set(existingUsers.map((user) => user.id));
    const missingIds = Array.from(referencedUserIds).filter((id) => !existingIds.has(id));

    if (missingIds.length === 0) {
      return;
    }

    await this.prisma.user.createMany({
      data: missingIds.map(buildSeedUser),
    });
  }

  async setInvite(invite: InviteSeed): Promise<InviteRecord> {
    const payload = mapInviteSeed(invite);

    return this.prisma.invite.upsert({
      where: { code: payload.code },
      update: payload,
      create: payload,
    });
  }

  getInvite(code: string): Promise<InviteRecord | null> {
    return this.prisma.invite.findUnique({ where: { code } });
  }

  async markRedeemed(code: string, userId: string): Promise<InviteRecord | null> {
    try {
      return await this.prisma.invite.update({
        where: { code },
        data: { redeemedAt: new Date(), redeemedById: userId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }

      throw error;
    }
  }
}
