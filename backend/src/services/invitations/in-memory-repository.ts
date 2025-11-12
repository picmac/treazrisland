import { randomUUID } from 'node:crypto';

import type {
  CreateInvitationRecord,
  InvitationRecord,
  InvitationRepository,
  FindInvitationQuery,
} from './types';

export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly records: InvitationRecord[] = [];

  async create(record: CreateInvitationRecord): Promise<InvitationRecord> {
    const created: InvitationRecord = {
      id: randomUUID(),
      email: record.email,
      tokenHash: record.tokenHash,
      createdById: record.createdById ?? null,
      createdAt: new Date(),
      expiresAt: record.expiresAt ?? null,
    };

    this.records.push(created);
    return created;
  }

  async findLatest(query: FindInvitationQuery): Promise<InvitationRecord | null> {
    const matches = this.records.filter((record) => record.email === query.email);
    if (!matches.length) {
      return null;
    }

    return matches[matches.length - 1];
  }

  list(): InvitationRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }
}
