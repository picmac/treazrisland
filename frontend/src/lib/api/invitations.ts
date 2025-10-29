import { apiFetch } from "@lib/api/client";

type PreviewResponse = {
  invitation: {
    role: string;
    email: string | null;
  };
};

type SignupResponse = {
  user: {
    id: string;
    email: string;
    nickname: string;
    role: string;
  };
  accessToken: string;
  refreshExpiresAt: string;
};

type InvitationRecord = {
  id: string;
  role: string;
  email: string | null;
  expiresAt: string;
  redeemedAt: string | null;
  createdAt: string;
};

export async function previewInvitation(token: string): Promise<PreviewResponse> {
  return apiFetch<PreviewResponse>("/auth/invitations/preview", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export async function signupWithInvitation(payload: {
  token: string;
  email?: string;
  nickname: string;
  password: string;
  displayName?: string;
}): Promise<SignupResponse> {
  return apiFetch<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createInvitation(payload: {
  email?: string;
  role: string;
  expiresInHours?: number;
}): Promise<{ invitation: InvitationRecord; token: string }> {
  return apiFetch<{ invitation: InvitationRecord; token: string }>("/users/invitations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listInvitations(): Promise<{ invitations: InvitationRecord[] }> {
  return apiFetch<{ invitations: InvitationRecord[] }>("/users/invitations", {
    method: "GET"
  });
}
