export type NetplayParticipantRole = "HOST" | "GUEST";

export type NetplaySessionStatus =
  | "PENDING"
  | "ACTIVE"
  | "ENDED"
  | "CANCELLED";

export interface NetplayParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: NetplayParticipantRole;
  nickname: string;
  displayName: string | null;
  joinedAt: Date;
}

export interface NetplaySession {
  id: string;
  hostUserId: string;
  romId: string | null;
  joinCode: string;
  status: NetplaySessionStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  externalSessionId: string | null;
  participants: NetplayParticipant[];
}

export type NetplayServiceDeleteParams = {
  sessionId: string;
  requestingUserId: string;
};

export interface NetplayService {
  createSession(input: {
    hostUserId: string;
    romId?: string | null;
    ttlMinutes: number;
  }): Promise<NetplaySession>;
  joinSession(input: { userId: string; joinCode: string }): Promise<NetplaySession>;
  listSessionsForUser(userId: string): Promise<NetplaySession[]>;
  getSessionById(sessionId: string): Promise<NetplaySession | null>;
  deleteSession(input: NetplayServiceDeleteParams): Promise<void>;
}

export type NetplayServiceErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_CLOSED"
  | "SESSION_FULL"
  | "ALREADY_JOINED"
  | "INVALID_JOIN_CODE"
  | "UNAUTHORIZED"
  | "MAX_ACTIVE_SESSIONS"
  | "UNKNOWN";

export class NetplayServiceError extends Error {
  public readonly code: NetplayServiceErrorCode;

  constructor(message: string, code: NetplayServiceErrorCode) {
    super(message);
    this.name = "NetplayServiceError";
    this.code = code;
  }
}

export const isNetplayServiceError = (value: unknown): value is NetplayServiceError => {
  if (value instanceof NetplayServiceError) {
    return true;
  }

  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
};
