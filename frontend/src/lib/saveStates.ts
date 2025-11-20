import { apiClient, type JsonRecord } from './apiClient';
import type { SaveState } from '@/types/saveState';

export interface LatestSaveStateResponse {
  saveState: SaveState;
  data: string;
}

export interface SaveStateCreateResponse {
  saveState: SaveState;
}

export interface SaveStatePayload extends JsonRecord {
  data: string;
  label?: string;
  slot?: number;
  contentType: string;
}

export function fetchLatestSaveState(romId: string) {
  return apiClient.get<LatestSaveStateResponse>(`/roms/${romId}/save-state/latest`, {
    requiresAuth: true,
  });
}

export function persistSaveState(romId: string, payload: SaveStatePayload) {
  return apiClient.post<SaveStateCreateResponse>(`/roms/${romId}/save-state`, payload, {
    requiresAuth: true,
  });
}
