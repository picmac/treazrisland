export interface NetplayParticipant {
  id: string;
  userId: string;
  role: string;
  status: string;
  lastHeartbeatAt?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetplaySession {
  id: string;
  romId: string;
  hostId: string;
  saveStateId?: string;
  status: string;
  expiresAt: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  participants: NetplayParticipant[];
}

export interface NetplaySessionListResponse {
  sessions: NetplaySession[];
}

export interface NetplaySessionResponse {
  session: NetplaySession;
}

export interface NetplaySessionWithTokenResponse extends NetplaySessionResponse {
  peerToken: string;
}
