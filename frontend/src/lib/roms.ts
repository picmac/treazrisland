import { API_BASE_URL } from './apiClient';
import type { RomDetails } from '@/types/rom';

interface RomDetailsResponse {
  rom: RomDetails;
}

export async function fetchRomDetails(romId: string): Promise<RomDetails | null> {
  const response = await fetch(`${API_BASE_URL}/roms/${romId}`, {
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load ROM (${response.status})`);
  }

  const payload = (await response.json()) as RomDetailsResponse;
  return {
    ...payload.rom,
    isFavorite: payload.rom.isFavorite ?? false
  };
}
