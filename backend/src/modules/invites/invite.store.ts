import { randomUUID } from 'node:crypto';

import type { AuthUser } from '../auth/types';

export type InviteSeed = {
  code: string;
  email?: string;
  expiresAt?: Date;
  redeemedAt?: Date;
  redeemedById?: string;
};

export type InviteRecord = InviteSeed & {
  createdAt: Date;
};

export type StoredInviteUser = AuthUser & {
  passwordHash: string;
  createdAt: Date;
};

export class InMemoryInviteStore {
  private readonly invites = new Map<string, InviteRecord>();

  private readonly usersByEmail = new Map<string, StoredInviteUser>();

  constructor(initialInvites: InviteSeed[] = []) {
    this.reset(initialInvites);
  }

  reset(invites: InviteSeed[] = []): void {
    this.invites.clear();
    this.usersByEmail.clear();

    invites.forEach((invite) => {
      this.setInvite(invite);
    });
  }

  setInvite(invite: InviteSeed): InviteRecord {
    const record: InviteRecord = {
      createdAt: new Date(),
      ...invite,
    };

    this.invites.set(record.code, record);
    return record;
  }

  getInvite(code: string): InviteRecord | undefined {
    return this.invites.get(code);
  }

  markRedeemed(code: string, userId: string): InviteRecord | undefined {
    const invite = this.invites.get(code);

    if (!invite) {
      return undefined;
    }

    invite.redeemedAt = new Date();
    invite.redeemedById = userId;
    this.invites.set(code, invite);
    return invite;
  }

  createUser(email: string, passwordHash: string): StoredInviteUser {
    const normalizedEmail = email.toLowerCase();
    const existing = this.usersByEmail.get(normalizedEmail);

    if (existing) {
      return existing;
    }

    const user: StoredInviteUser = {
      id: randomUUID(),
      email,
      passwordHash,
      createdAt: new Date(),
    };

    this.usersByEmail.set(normalizedEmail, user);
    return user;
  }

  getUserByEmail(email: string): StoredInviteUser | undefined {
    return this.usersByEmail.get(email.toLowerCase());
  }
}

export const defaultInviteSeeds: InviteSeed[] = [
  {
    code: 'WELCOME-2024',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  },
];
