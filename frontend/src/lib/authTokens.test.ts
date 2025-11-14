import { afterEach, describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_KEY } from '@/constants/auth';

import { clearStoredAccessToken, getStoredAccessToken, storeAccessToken } from './authTokens';

const readCookie = (name: string) => {
  const rawValue = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')[1];

  return rawValue ? decodeURIComponent(rawValue) : undefined;
};

describe('authTokens', () => {
  afterEach(() => {
    clearStoredAccessToken();
    window.localStorage.clear();
  });

  it('stores the token in both localStorage and a cookie', () => {
    storeAccessToken('token-123');

    expect(getStoredAccessToken()).toBe('token-123');
    expect(readCookie(ACCESS_TOKEN_KEY)).toBe('token-123');
  });

  it('clears the token from both storage layers', () => {
    storeAccessToken('token-456');
    clearStoredAccessToken();

    expect(getStoredAccessToken()).toBeNull();
    expect(readCookie(ACCESS_TOKEN_KEY)).toBeUndefined();
  });
});
