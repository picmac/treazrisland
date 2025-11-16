import { getStoredAccessToken } from '@/lib/authTokens';

const DEFAULT_BROWSER_API_BASE_URL = '/api';
const DEFAULT_SERVER_API_BASE_URL = 'http://localhost:4000';

const isAbsoluteUrl = (value: string | undefined): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

const resolveBrowserBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BROWSER_API_BASE_URL;

const resolveServerBaseUrl = () => {
  if (isAbsoluteUrl(process.env.NEXT_INTERNAL_API_BASE_URL)) {
    return process.env.NEXT_INTERNAL_API_BASE_URL;
  }

  if (isAbsoluteUrl(process.env.NEXT_PUBLIC_API_BASE_URL)) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  return DEFAULT_SERVER_API_BASE_URL;
};

export const resolveRequestScopedServerBaseUrl = (headers: Headers) => {
  if (isAbsoluteUrl(process.env.NEXT_INTERNAL_API_BASE_URL)) {
    return process.env.NEXT_INTERNAL_API_BASE_URL;
  }

  if (isAbsoluteUrl(process.env.NEXT_PUBLIC_API_BASE_URL)) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  const forwardedHostHeader = headers.get('x-forwarded-host');
  if (forwardedHostHeader) {
    const forwardedHost = forwardedHostHeader.split(',')[0]?.trim();

    if (forwardedHost) {
      const forwardedProtoHeader = headers.get('x-forwarded-proto');
      const forwardedProto = forwardedProtoHeader?.split(',')[0]?.trim();
      const protocol = forwardedProto && forwardedProto.length > 0 ? forwardedProto : 'http';
      return `${protocol}://${forwardedHost}${DEFAULT_BROWSER_API_BASE_URL}`;
    }
  }

  return DEFAULT_SERVER_API_BASE_URL;
};

export const API_BASE_URL =
  typeof window === 'undefined' ? resolveServerBaseUrl() : resolveBrowserBaseUrl();

export type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init: RequestInit,
    options?: { requiresAuth?: boolean },
  ): Promise<T> {
    const accessToken = getStoredAccessToken();

    if (options?.requiresAuth && !accessToken) {
      throw new ApiError('You must be signed in to perform this action.', 401);
    }

    const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const mergedHeaders = {
      ...authHeaders,
      ...(init.headers ?? {}),
    } as Record<string, string>;

    if (init.body !== undefined && !('Content-Type' in mergedHeaders)) {
      mergedHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergedHeaders,
      cache: 'no-store',
      credentials: 'include',
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

  get<T>(path: string, options?: { requiresAuth?: boolean }): Promise<T> {
    return this.request<T>(path, { method: 'GET' }, options);
  }

  post<T>(path: string, body?: JsonRecord, options?: { requiresAuth?: boolean }): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  patch<T>(path: string, body?: JsonRecord, options?: { requiresAuth?: boolean }): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  put<T>(path: string, body?: JsonRecord, options?: { requiresAuth?: boolean }): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      },
      options,
    );
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

export function redeemInviteToken(
  token: string,
  payload: { email: string; password: string; displayName?: string },
) {
  return apiClient.post<InviteRedemptionResponse>(`/auth/invitations/${token}/redeem`, payload);
}

export interface RomFavoriteResponse {
  romId: string;
  isFavorite: boolean;
}

export function toggleRomFavorite(romId: string) {
  return apiClient.post<RomFavoriteResponse>(`/roms/${romId}/favorite`, undefined, {
    requiresAuth: true,
  });
}
