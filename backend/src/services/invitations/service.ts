import { createHash, randomBytes } from 'node:crypto';

import type { InvitationRepository } from './types';

export type CreateInvitationInput = {
  email: string;
  createdById?: string | null;
  expiresInHours?: number;
};

export type CreatedInvitation = {
  token: string;
  invite: {
    id: string;
    email: string;
    createdAt: Date;
    expiresAt: Date | null;
    createdById: string | null;
  };
};

export class InvitationService {
  constructor(private readonly repository: InvitationRepository) {}

  async createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt =
      typeof input.expiresInHours === 'number'
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;

    const invite = await this.repository.create({
      email: input.email,
      tokenHash,
      createdById: input.createdById ?? null,
      expiresAt,
    });

    return {
      token,
      invite,
    };
  }
}
