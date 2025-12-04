const REFRESH_ENDPOINT = '/api/auth/refresh';

let cachedAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

type AuthResponsePayload = {
  accessToken?: unknown;
};

export function storeAccessToken(token: string) {
  cachedAccessToken = token;
}

export function clearStoredAccessToken() {
  cachedAccessToken = null;
}

export async function getStoredAccessToken(): Promise<string | null> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken();
  }

  const refreshedToken = await refreshPromise;
  refreshPromise = null;
  return refreshedToken;
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof fetch === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuthResponsePayload;
    const token = typeof payload.accessToken === 'string' ? payload.accessToken : null;

    if (token) {
      storeAccessToken(token);
      return token;
    }
  } catch {
    return null;
  }

  return null;
}
