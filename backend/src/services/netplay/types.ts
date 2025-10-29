export type NetplayParticipant = {
  id: string;
  userId: string;
  displayName?: string | null;
  joinedAt: Date;
};

export type NetplaySession = {
  id: string;
  hostId: string;
  hostDisplayName?: string | null;
  joinCode: string;
  gameId?: string | null;
  expiresAt: Date;
  createdAt: Date;
  endedAt: Date | null;
  participants: NetplayParticipant[];
};

export type NetplayJoinResult = {
  session: NetplaySession;
  participant: NetplayParticipant;
};

export type NetplayService = {
  createSession: (params: {
    hostId: string;
    ttlMinutes: number;
    gameId?: string | null;
  }) => Promise<NetplaySession>;
  joinSession: (params: {
    joinCode: string;
    playerId: string;
  }) => Promise<NetplayJoinResult>;
  listSessions: (params: { userId: string }) => Promise<NetplaySession[]>;
  getSession: (params: { sessionId: string }) => Promise<NetplaySession | null>;
  endSession: (params: {
    sessionId: string;
    requestedBy: string;
  }) => Promise<void>;
};

export class NetplayServiceError extends Error {
  public readonly code: string;

  public readonly statusCode: number;

  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "NetplayServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const isNetplayServiceError = (value: unknown): value is NetplayServiceError => {
  if (value instanceof NetplayServiceError) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeError = value as { code?: unknown; statusCode?: unknown; message?: unknown };

  return (
    typeof maybeError.code === "string" &&
    typeof maybeError.statusCode === "number" &&
    typeof maybeError.message === "string"
  );
};
