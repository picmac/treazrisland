import { ACCESS_TOKEN_KEY } from '@/constants/auth';

const REFRESH_ENDPOINT = '/api/auth/refresh';

let cachedAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let refreshEnabled = true;

const isBrowser = () => typeof window !== 'undefined';

const readTokenFromStorage = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  const stored = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return stored && stored.length > 0 ? stored : null;
};

const persistTokenToStorage = (token: string) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

const clearTokenFromStorage = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export type AuthResponsePayload = {
  accessToken?: unknown;
};

export function storeAccessToken(token: string) {
  refreshEnabled = true;
  cachedAccessToken = token;
  persistTokenToStorage(token);
}

export function clearStoredAccessToken(options?: { disableRefresh?: boolean }) {
  cachedAccessToken = null;
  if (options?.disableRefresh) {
    refreshEnabled = false;
    refreshPromise = null;
  } else {
    refreshEnabled = true;
  }
  clearTokenFromStorage();
}

export async function getStoredAccessToken(): Promise<string | null> {
  if (!refreshEnabled) {
    return null;
  }

  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const storedToken = readTokenFromStorage();
  if (storedToken) {
    cachedAccessToken = storedToken;
    return storedToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken();
  }

  const refreshedToken = await refreshPromise;
  refreshPromise = null;
  return refreshedToken;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshEnabled) {
    return null;
  }

  if (typeof fetch === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok || !refreshEnabled) {
      return null;
    }

    const payload = (await response.json()) as AuthResponsePayload;
    const token = typeof payload.accessToken === 'string' ? payload.accessToken : null;

    if (token && refreshEnabled) {
      storeAccessToken(token);
      return token;
    }
  } catch {
    return null;
  }

  return null;
}
