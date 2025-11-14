import { API_BASE_URL } from './apiClient';
import { getStoredAccessToken } from './authTokens';
import type { RomDetails } from '@/types/rom';

interface RomDetailsResponse {
  rom: RomDetails;
}

export async function fetchRomDetails(
  romId: string,
  requestInit?: RequestInit,
): Promise<RomDetails | null> {
  const headers = new Headers(requestInit?.headers);
  const accessToken = getStoredAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}/roms/${romId}`, {
    ...requestInit,
    headers,
    cache: requestInit?.cache ?? 'no-store',
    credentials: requestInit?.credentials ?? 'include',
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
    isFavorite: payload.rom.isFavorite ?? false,
  };
}
