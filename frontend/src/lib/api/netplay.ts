import { apiFetch } from "@lib/api/client";

export type NetplayParticipant = {
  id: string;
  userId: string;
  displayName: string | null;
  nickname: string;
  role: string;
  status: string;
  joinedAt: string;
  leftAt: string | null;
};

export type NetplaySession = {
  id: string;
  code: string;
  hostId: string;
  romId: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  externalSessionId?: string | null;
  participants: NetplayParticipant[];
  isHost?: boolean;
};

type CreateSessionPayload = {
  romId?: string;
  expiresInMinutes: number;
  displayName?: string;
};

type JoinSessionPayload = {
  code: string;
  displayName?: string;
};

export async function createNetplaySession(payload: CreateSessionPayload): Promise<{ session: NetplaySession }> {
  return apiFetch<{ session: NetplaySession }>("/netplay/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function joinNetplaySession(payload: JoinSessionPayload): Promise<{
  session: NetplaySession;
  participant: NetplayParticipant;
}> {
  return apiFetch<{ session: NetplaySession; participant: NetplayParticipant }>("/netplay/sessions/join", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listNetplaySessions(): Promise<{ sessions: NetplaySession[] }> {
  return apiFetch<{ sessions: NetplaySession[] }>("/netplay/sessions", {
    method: "GET"
  });
}

export async function getNetplaySession(sessionId: string): Promise<{ session: NetplaySession }> {
  return apiFetch<{ session: NetplaySession }>(`/netplay/sessions/${sessionId}`, {
    method: "GET"
  });
}

export async function endNetplaySession(sessionId: string): Promise<{ session: NetplaySession }> {
  return apiFetch<{ session: NetplaySession }>(`/netplay/sessions/${sessionId}`, {
    method: "DELETE"
  });
}
