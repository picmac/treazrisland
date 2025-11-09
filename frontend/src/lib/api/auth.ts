import { apiFetch, apiRequest } from "@lib/api/client";

type SetCookieHeader = string[];

const REFRESH_CSRF_COOKIE_NAME = "treaz_refresh_csrf";
const REFRESH_CSRF_HEADER = "x-refresh-csrf";

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  role: string;
}

export interface SessionPayload {
  user: SessionUser;
  accessToken: string;
  refreshExpiresAt: string;
}

export interface LoginResponse extends SessionPayload {
  mfaRequired?: boolean;
}

export interface SignupResponse extends SessionPayload {}

export interface MfaSetupResponse {
  secretId: string;
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

function extractSetCookies(response: Response): SetCookieHeader {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function readRefreshCsrfTokenFromCookies(): string | null {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return null;
  }

  const prefix = `${REFRESH_CSRF_COOKIE_NAME}=`;
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!entry) {
    return null;
  }

  const rawValue = entry.slice(prefix.length);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function withRefreshCsrf(init?: RequestInit): RequestInit {
  const baseInit: RequestInit = init ? { ...init } : {};
  const csrfToken = readRefreshCsrfTokenFromCookies();
  if (!csrfToken) {
    return baseInit;
  }

  const headers = new Headers(baseInit.headers ?? {});
  headers.set(REFRESH_CSRF_HEADER, csrfToken);
  return { ...baseInit, headers };
}

export async function login(payload: {
  identifier: string;
  password: string;
  mfaCode?: string;
  recoveryCode?: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function loginWithCookies(
  payload: {
    identifier: string;
    password: string;
    mfaCode?: string;
    recoveryCode?: string;
  },
  options?: { cookieHeader?: string }
): Promise<{ payload: LoginResponse; cookies: SetCookieHeader }> {
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: options?.cookieHeader
      ? {
          cookie: options.cookieHeader
        }
      : undefined
  });

  const data = (await response.json()) as LoginResponse;
  return { payload: data, cookies: extractSetCookies(response) };
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", withRefreshCsrf({ method: "POST" }));
}

export async function refreshSession(): Promise<SessionPayload> {
  return apiFetch<SessionPayload>("/auth/refresh", withRefreshCsrf({ method: "POST" }));
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/password/reset/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function confirmPasswordResetWithCookies(
  payload: {
    token: string;
    password: string;
  },
  options?: { cookieHeader?: string }
): Promise<{ payload: SessionPayload; cookies: SetCookieHeader }> {
  const response = await apiRequest("/auth/password/reset/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: options?.cookieHeader ? { cookie: options.cookieHeader } : undefined,
  });

  const data = (await response.json()) as SessionPayload;
  return { payload: data, cookies: extractSetCookies(response) };
}

export async function confirmPasswordReset(payload: {
  token: string;
  password: string;
}): Promise<SessionPayload> {
  const { payload: data } = await confirmPasswordResetWithCookies(payload);
  return data;
}

export async function redeemInvitation(
  payload: {
    token: string;
    email?: string;
    nickname: string;
    password: string;
    displayName?: string;
  },
  options?: { cookieHeader?: string }
): Promise<{ payload: SignupResponse; cookies: SetCookieHeader }> {
  const response = await apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: options?.cookieHeader
      ? {
          cookie: options.cookieHeader
        }
      : undefined
  });

  const data = (await response.json()) as SignupResponse;
  return { payload: data, cookies: extractSetCookies(response) };
}

export async function signupWithInvitation(payload: {
  token: string;
  email?: string;
  nickname: string;
  password: string;
  displayName?: string;
}): Promise<SignupResponse> {
  const { payload: data } = await redeemInvitation(payload);
  return data;
}

export async function startMfaSetup(): Promise<MfaSetupResponse> {
  return apiFetch<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
}

export async function confirmMfaSetup(payload: {
  secretId: string;
  code: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mfa/confirm", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function disableMfa(payload: {
  mfaCode?: string;
  recoveryCode?: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
