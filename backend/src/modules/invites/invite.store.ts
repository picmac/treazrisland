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

export class PrismaInviteStore {
  constructor(private readonly prisma: PrismaClient) {}

  async reset(invites: InviteSeed[] = []): Promise<void> {
    await this.prisma.invite.deleteMany();

    if (invites.length === 0) {
      return;
    }

    await this.prisma.invite.createMany({
      data: invites.map(mapInviteSeed),
      skipDuplicates: true,
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
