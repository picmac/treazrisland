import { ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS, ACCESS_TOKEN_KEY } from '@/constants/auth';

const ACCESS_TOKEN_STORAGE_KEY = ACCESS_TOKEN_KEY;
const ACCESS_TOKEN_COOKIE = ACCESS_TOKEN_KEY;

export function storeAccessToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  setAccessTokenCookie(token);
}

export function clearStoredAccessToken() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  removeAccessTokenCookie();
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function setAccessTokenCookie(token: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const isSecureContext = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureDirective = isSecureContext ? '; Secure' : '';

  document.cookie =
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS}` +
    secureDirective;
}

function removeAccessTokenCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
