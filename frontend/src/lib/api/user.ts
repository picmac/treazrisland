import { apiFetch } from "@lib/api/client";

export interface UserAvatarMetadata {
  storageKey: string;
  mimeType: string | null;
  fileSize: number | null;
  updatedAt: string | null;
  url: string;
  signedUrlExpiresAt: string | null;
  fallbackPath: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  displayName: string | null;
  role: string;
  avatar: UserAvatarMetadata | null;
  mfaEnabled: boolean;
}

export interface UserProfileResponse {
  user: UserProfile;
}

export interface UpdateUserProfilePayload {
  nickname?: string;
  displayName?: string;
  removeAvatar?: boolean;
  avatarFile?: File | null;
}

export async function getCurrentUserProfile(): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>("/users/me", { method: "GET" });
}

export async function updateUserProfile(
  payload: UpdateUserProfilePayload,
): Promise<UserProfileResponse> {
  const { nickname, displayName, removeAvatar, avatarFile } = payload;
  const hasAvatarFile =
    typeof File !== "undefined" && avatarFile instanceof File;

  if (hasAvatarFile) {
    const formData = new FormData();
    if (nickname !== undefined) {
      formData.append("nickname", nickname);
    }
    if (displayName !== undefined) {
      formData.append("displayName", displayName);
    }
    formData.append("avatar", avatarFile);
    if (removeAvatar === true) {
      formData.append("removeAvatar", "true");
    }

    return apiFetch<UserProfileResponse>("/users/me", {
      method: "PATCH",
      body: formData,
    });
  }

  const body: Record<string, unknown> = {};
  if (nickname !== undefined) {
    body.nickname = nickname;
  }
  if (displayName !== undefined) {
    body.displayName = displayName;
  }
  if (removeAvatar === true) {
    body.removeAvatar = true;
  }

  return apiFetch<UserProfileResponse>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
