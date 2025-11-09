import { apiFetch } from "@lib/api/client";
import type {
  NetplaySessionListResponse,
  NetplaySessionResponse,
  NetplaySessionWithTokenResponse,
} from "./types";

export async function listNetplaySessions(): Promise<NetplaySessionListResponse> {
  return apiFetch<NetplaySessionListResponse>("/netplay/sessions");
}

export async function createNetplaySession(payload: {
  romId: string;
  saveStateId?: string;
}): Promise<NetplaySessionWithTokenResponse> {
  return apiFetch<NetplaySessionWithTokenResponse>("/netplay/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function inviteToNetplaySession(
  sessionId: string,
  userId: string,
): Promise<NetplaySessionResponse> {
  return apiFetch<NetplaySessionResponse>(`/netplay/sessions/${sessionId}/invite`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function joinNetplaySession(
  sessionId: string,
): Promise<NetplaySessionWithTokenResponse> {
  return apiFetch<NetplaySessionWithTokenResponse>(
    `/netplay/sessions/${sessionId}/join`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function sendNetplayHeartbeat(
  sessionId: string,
  payload: { peerToken: string; status?: "connected" | "disconnected" },
): Promise<void> {
  await apiFetch<void>(`/netplay/sessions/${sessionId}/heartbeat`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function closeNetplaySession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/netplay/sessions/${sessionId}`, {
    method: "DELETE",
  });
}
