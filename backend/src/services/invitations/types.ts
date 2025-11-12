export type InvitationRecord = {
  id: string;
  email: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date | null;
  createdById: string | null;
};

export type CreateInvitationRecord = {
  email: string;
  tokenHash: string;
  createdById?: string | null;
  expiresAt?: Date | null;
};

export type FindInvitationQuery = {
  email: string;
};

export interface InvitationRepository {
  create(record: CreateInvitationRecord): Promise<InvitationRecord>;
  findLatest(query: FindInvitationQuery): Promise<InvitationRecord | null>;
}
