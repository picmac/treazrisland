import { getStoredAccessToken } from '@/lib/authTokens';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const accessToken = getStoredAccessToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers ?? {})
      },
      cache: 'no-store',
      credentials: 'include'
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : typeof payload === 'string' && payload.length > 0
            ? payload
            : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status);
    }

    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: JsonRecord): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName?: string | null;
  };
}

export interface InviteRedemptionResponse {
  message: string;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
  };
}

export function loginWithPassword(email: string, password: string) {
  return apiClient.post<AuthResponse>('/auth/login', { email, password });
}

export function exchangeMagicLinkToken(token: string) {
  return apiClient.post<AuthResponse>('/auth/magic-link', { token });
}

export function redeemInviteToken(token: string, payload: { email: string; password: string; displayName?: string }) {
  return apiClient.post<InviteRedemptionResponse>(`/invites/${token}/redeem`, payload);
}

export interface RomFavoriteResponse {
  romId: string;
  isFavorite: boolean;
}

export function toggleRomFavorite(romId: string) {
  return apiClient.post<RomFavoriteResponse>(`/roms/${romId}/favorite`);
}
