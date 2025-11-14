import { ApiError, apiClient } from './apiClient';
import type { RomDetails } from '@/types/rom';

interface RomDetailsResponse {
  rom: RomDetails;
}

export async function fetchRomDetails(romId: string): Promise<RomDetails | null> {
  try {
    const payload = await apiClient.get<RomDetailsResponse>(`/roms/${romId}`);
    return {
      ...payload.rom,
      isFavorite: payload.rom.isFavorite ?? false,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
