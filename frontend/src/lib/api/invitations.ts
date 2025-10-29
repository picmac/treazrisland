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
  refreshToken: string;
  refreshExpiresAt: string;
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
