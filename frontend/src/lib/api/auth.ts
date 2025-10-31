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

export interface MfaSetupResponse {
  secretId: string;
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
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

export async function startMfaSetup(): Promise<MfaSetupResponse> {
  return apiFetch<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
}

export async function confirmMfaSetup(payload: {
  secretId: string;
  code: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mfa/confirm", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function disableMfa(payload: {
  mfaCode?: string;
  recoveryCode?: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
