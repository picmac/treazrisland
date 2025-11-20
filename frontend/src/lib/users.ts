import { apiClient } from './apiClient';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarObjectKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfileResponse {
  user: UserProfile;
  isProfileComplete: boolean;
}

export interface AvatarUploadGrant {
  uploadUrl: string;
  objectKey: string;
  headers?: Record<string, string>;
}

export function getCurrentUserProfile() {
  return apiClient.get<UserProfileResponse>('/users/me', { requiresAuth: true });
}

export function updateUserProfile(payload: {
  displayName?: string;
  avatarObjectKey?: string | null;
}) {
  return apiClient.patch<UserProfileResponse>('/users/me', payload, { requiresAuth: true });
}

export function requestAvatarUploadGrant(payload: {
  filename: string;
  contentType: string;
  size: number;
}) {
  return apiClient.post<AvatarUploadGrant>('/users/me/avatar-upload', payload, {
    requiresAuth: true,
  });
}
