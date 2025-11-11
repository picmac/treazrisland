"use server";

import { cookies, headers } from "next/headers";

import { resolveApiBase } from "@/src/lib/api/client";
import type { SessionPayload } from "@/src/lib/api/auth";
import { applyBackendCookies, buildCookieHeaderFromStore } from "./backend-cookies";

const REFRESH_CSRF_COOKIE_NAME = "treaz_refresh_csrf";
const REFRESH_CSRF_HEADER = "x-refresh-csrf";

function extractSetCookies(response: Response): readonly string[] {
  const headerBag = response.headers as unknown as {
    getSetCookie?: () => string[];
  };

  if (typeof headerBag.getSetCookie === "function") {
    return headerBag.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

async function readRefreshCsrfToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_CSRF_COOKIE_NAME)?.value;
}

export async function refreshSessionFromCookies(): Promise<SessionPayload> {
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

  const setCookieHeaders = extractSetCookies(response);
  if (setCookieHeaders.length > 0) {
    await applyBackendCookies(setCookieHeaders);
  }

  return (await response.json()) as SessionPayload;
}
