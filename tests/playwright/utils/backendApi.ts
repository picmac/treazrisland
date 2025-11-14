import { expect, type APIRequestContext } from '@playwright/test';
import { backendBaseUrl } from './env';
import { defaultCredentials, type LoginCredentials } from './auth';

interface AuthResponse {
  accessToken: string;
}

interface RomDetailsResponse {
  rom: {
    isFavorite?: boolean;
  };
}

interface SaveStateResponse {
  saveState: {
    id: string;
    romId: string;
  };
  data: string;
}

export async function obtainAccessToken(
  request: APIRequestContext,
  credentials: LoginCredentials = defaultCredentials,
): Promise<string> {
  const response = await request.post(`${backendBaseUrl}/auth/login`, { data: credentials });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as AuthResponse;
  expect(payload.accessToken).toBeTruthy();
  return payload.accessToken;
}

export async function fetchFavoriteState(
  request: APIRequestContext,
  token: string,
  romId: string,
): Promise<boolean> {
  const response = await request.get(`${backendBaseUrl}/roms/${romId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok()) {
    throw new Error(`Failed to load ROM state (${response.status()})`);
  }

  const payload = (await response.json()) as RomDetailsResponse;
  return Boolean(payload.rom.isFavorite);
}

export async function fetchLatestSaveState(
  request: APIRequestContext,
  token: string,
  romId: string,
): Promise<SaveStateResponse | null> {
  const response = await request.get(`${backendBaseUrl}/roms/${romId}/save-state/latest`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status() === 404) {
    return null;
  }

  if (!response.ok()) {
    throw new Error(`Failed to load save state (${response.status()})`);
  }

  return (await response.json()) as SaveStateResponse;
}
