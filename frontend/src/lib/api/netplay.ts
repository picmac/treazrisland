import { apiFetch } from "@lib/api/client";

export type NetplayParticipant = {
  id: string;
  nickname: string;
  userId: string | null;
  isHost: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "PENDING";
  joinedAt: string;
};

export type NetplaySession = {
  id: string;
  romId: string | null;
  joinCode: string;
  status: "PENDING" | "ACTIVE" | "ENDED";
  isHost: boolean;
  canManage: boolean;
  createdAt: string;
  expiresAt: string;
  participants: NetplayParticipant[];
};

type HostSessionPayload = {
  romId?: string;
  ttlMinutes?: number;
};

type HostSessionResponse = {
  session: NetplaySession;
};

type JoinSessionPayload = {
  joinCode: string;
  nickname?: string;
};

type JoinSessionResponse = {
  session: NetplaySession;
  participant: NetplayParticipant;
};

type ListSessionsResponse = {
  sessions: NetplaySession[];
};

type ManageSessionResponse = {
  success: boolean;
};

export async function hostNetplaySession(payload: HostSessionPayload, init?: RequestInit): Promise<HostSessionResponse> {
  return apiFetch<HostSessionResponse>("/netplay/sessions", {
    ...(init ?? {}),
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function joinNetplaySession(payload: JoinSessionPayload, init?: RequestInit): Promise<JoinSessionResponse> {
  return apiFetch<JoinSessionResponse>("/netplay/sessions/join", {
    ...(init ?? {}),
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listNetplaySessions(init?: RequestInit): Promise<ListSessionsResponse> {
  return apiFetch<ListSessionsResponse>("/netplay/sessions", {
    ...(init ?? {}),
    method: "GET"
  });
}

export async function cancelNetplaySession(sessionId: string, init?: RequestInit): Promise<ManageSessionResponse> {
  return apiFetch<ManageSessionResponse>(`/netplay/sessions/${sessionId}`, {
    ...(init ?? {}),
    method: "DELETE"
  });
}

export async function leaveNetplaySession(sessionId: string, init?: RequestInit): Promise<ManageSessionResponse> {
  return apiFetch<ManageSessionResponse>(`/netplay/sessions/${sessionId}/leave`, {
    ...(init ?? {}),
    method: "POST"
  });
}
