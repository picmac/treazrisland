import { ApiError, apiClient, resolveRequestScopedServerBaseUrl } from './apiClient';
import { getStoredAccessToken } from './authTokens';
import type { RomDetails, RomSummary } from '@/types/rom';

interface RomListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface RomListResponse {
  items: RomSummary[];
  meta: RomListMeta;
}

export interface RomListFilters {
  page?: number;
  pageSize?: number;
  platform?: string;
  genre?: string;
  favorites?: boolean;
}

export async function listRoms(
  filters: RomListFilters = {},
): Promise<{ items: RomSummary[]; meta: RomListMeta }> {
  const params = new URLSearchParams();

  if (filters.page) {
    params.set('page', filters.page.toString());
  }

  if (filters.pageSize) {
    params.set('pageSize', filters.pageSize.toString());
  }

  if (filters.platform) {
    params.set('platform', filters.platform);
  }

  if (filters.genre) {
    params.set('genre', filters.genre);
  }

  if (filters.favorites) {
    params.set('favorites', 'true');
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  const payload = await apiClient.get<RomListResponse>(`/roms${query}`, {
    requiresAuth: Boolean(filters.favorites),
  });

  return {
    items: payload.items.map((rom) => ({
      ...rom,
      isFavorite: rom.isFavorite ?? false,
    })),
    meta: payload.meta,
  };
}

interface RomDetailsResponse {
  rom: RomDetails;
}

export async function fetchRomDetails(
  romId: string,
  requestInit?: RequestInit,
): Promise<RomDetails | null> {
  if (requestInit) {
    return fetchRomDetailsWithRequestInit(romId, requestInit);
  }

  try {
    const payload = await apiClient.get<RomDetailsResponse>(`/roms/${romId}`);
    return normalizeRomDetails(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchRomDetailsWithRequestInit(
  romId: string,
  requestInit: RequestInit,
): Promise<RomDetails | null> {
  const headers = new Headers(requestInit.headers);
  const accessToken = getStoredAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const baseUrl = resolveRequestScopedServerBaseUrl(headers);
  const response = await fetch(`${baseUrl}/roms/${romId}`, {
    ...requestInit,
    headers,
    cache: requestInit.cache ?? 'no-store',
    credentials: requestInit.credentials ?? 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load ROM (${response.status})`);
  }

  const payload = (await response.json()) as RomDetailsResponse;
  return normalizeRomDetails(payload);
}

function normalizeRomDetails(payload: RomDetailsResponse): RomDetails {
  return {
    ...payload.rom,
    isFavorite: payload.rom.isFavorite ?? false,
  };
}
