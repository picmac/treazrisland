import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '@/constants/auth';

import { clearStoredAccessToken, getStoredAccessToken, storeAccessToken } from './authTokens';

describe('authTokens', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    clearStoredAccessToken();
    window.localStorage.clear();
  });

  afterEach(() => {
    clearStoredAccessToken();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('returns a cached token and mirrors it to web storage', async () => {
    storeAccessToken('token-123');

    const token = await getStoredAccessToken();

    expect(token).toBe('token-123');
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('token-123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rehydrates a token stored in localStorage when cache is empty', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'token-from-storage');

    const token = await getStoredAccessToken();

    expect(token).toBe('token-from-storage');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests a refreshed access token when none is cached', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'refreshed-token' }),
    });

    const token = await getStoredAccessToken();

    expect(token).toBe('refreshed-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
      credentials: 'include',
      method: 'POST',
    });
  });

  it('clears the cached token so the next call refreshes again', async () => {
    storeAccessToken('token-stale');
    clearStoredAccessToken();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'fresh-after-clear' }),
    });

    const token = await getStoredAccessToken();

    expect(token).toBe('fresh-after-clear');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
