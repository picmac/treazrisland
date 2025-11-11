"use server";

import { cookies, headers } from "next/headers";

import { resolveApiBase } from "@/src/lib/api/client";
import type { SessionPayload } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore,
  extractSetCookieHeaders,
} from "./backend-cookies";

const REFRESH_CSRF_COOKIE_NAME = "treaz_refresh_csrf";
const REFRESH_CSRF_HEADER = "x-refresh-csrf";

async function readRefreshCsrfToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_CSRF_COOKIE_NAME)?.value;
}

export type RefreshSessionResult = {
  accessToken: string;
  payload: SessionPayload;
  cookies: readonly string[];
};

export async function refreshAccessTokenFromCookies(): Promise<RefreshSessionResult> {
  const apiBase = resolveApiBase(headers());
  const [cookieHeader, csrfToken] = await Promise.all([
    buildCookieHeaderFromStore(),
    readRefreshCsrfToken()
  ]);

  const requestHeaders = new Headers({
    Accept: "application/json"
  });

  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  }

  if (csrfToken) {
    requestHeaders.set(REFRESH_CSRF_HEADER, csrfToken);
  }

  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    headers: requestHeaders,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh session: ${response.status}`);
  }

  const payload = (await response.json()) as SessionPayload;
  const cookies = extractSetCookieHeaders(response);

  if (cookies.length > 0) {
    await applyBackendCookies(cookies);
  }

  return {
    accessToken: payload.accessToken,
    payload,
    cookies
  };
}
