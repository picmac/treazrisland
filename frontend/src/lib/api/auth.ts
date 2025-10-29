import { apiFetch } from "@lib/api/client";

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  role: string;
}

export interface SessionPayload {
  user: SessionUser;
  accessToken: string;
  refreshExpiresAt: string;
}

export interface LoginResponse extends SessionPayload {
  mfaRequired?: boolean;
}

export async function login(payload: {
  identifier: string;
  password: string;
  mfaCode?: string;
  recoveryCode?: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function refreshSession(): Promise<SessionPayload> {
  return apiFetch<SessionPayload>("/auth/refresh", {
    method: "POST"
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/password/reset/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function confirmPasswordReset(payload: {
  token: string;
  password: string;
}): Promise<SessionPayload> {
  return apiFetch<SessionPayload>("/auth/password/reset/confirm", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
