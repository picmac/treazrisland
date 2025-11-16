import { apiClient, type JsonRecord } from './apiClient';

export type DependencyStatus = 'up' | 'down';

export interface HealthDependencies {
  redis: { status: DependencyStatus };
  objectStorage: { status: 'configured'; bucket: string; region: string };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  dependencies: HealthDependencies;
}

export function runHealthCheck() {
  return apiClient.get<HealthResponse>('/health');
}

export interface AdminProfilePayload extends JsonRecord {
  displayName: string;
}

export interface AdminProfileResponse {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  isProfileComplete: boolean;
}

export function fetchAdminProfile() {
  return apiClient.get<AdminProfileResponse>('/auth/profile', { requiresAuth: true });
}

export function updateAdminProfile(payload: AdminProfilePayload) {
  return apiClient.patch<AdminProfileResponse>('/auth/profile', payload, { requiresAuth: true });
}

export interface EmulatorConfig {
  embedUrl: string;
  verifiedAt: string | null;
}

export function fetchEmulatorConfig() {
  return apiClient.get<{ config: EmulatorConfig }>('/admin/emulator-config', {
    requiresAuth: true,
  });
}

export function saveEmulatorConfig(payload: { embedUrl: string }) {
  return apiClient.put<{ config: EmulatorConfig }>('/admin/emulator-config', payload, {
    requiresAuth: true,
  });
}

export interface AdminRomUploadPayload extends JsonRecord {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  genres?: string[];
  asset: {
    type: 'ROM';
    filename: string;
    contentType: string;
    data: string;
    checksum: string;
  };
}

export interface AdminRomUploadResponse {
  rom: {
    id: string;
    title: string;
    assets?: Array<{ objectKey: string }>;
  };
}

export function registerAdminRom(payload: AdminRomUploadPayload) {
  return apiClient.post<AdminRomUploadResponse>('/admin/roms', payload, { requiresAuth: true });
}
