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
const SESSION_CACHE_COOKIE_NAME = "treaz_session";
const SESSION_CACHE_MIN_TTL_MS = 30_000;
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

type CachedSessionCookie = {
  payload: SessionPayload;
  accessTokenExpiresAt: string;
};

async function readRefreshCsrfToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_CSRF_COOKIE_NAME)?.value;
}

function decodeJwtExpiration(token: string): number | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadSegment = segments[1];
    const decoded = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { exp?: unknown };
    const exp =
      typeof parsed.exp === "number"
        ? parsed.exp
        : typeof parsed.exp === "string"
          ? Number(parsed.exp)
          : null;
    return Number.isFinite(exp) ? Number(exp) : null;
  } catch {
    return null;
  }
}

async function clearCachedSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_CACHE_COOKIE_NAME);
}

function parseCachedSession(raw: string | undefined): CachedSessionCookie | null {
  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CachedSessionCookie;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.payload ||
      typeof parsed.payload !== "object" ||
      typeof parsed.payload.accessToken !== "string" ||
      typeof parsed.accessTokenExpiresAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readCachedSession(): Promise<CachedSessionCookie | null> {
  const store = await cookies();
  const raw = store.get(SESSION_CACHE_COOKIE_NAME)?.value;
  const parsed = parseCachedSession(raw);

  if (!parsed) {
    if (raw) {
      store.delete(SESSION_CACHE_COOKIE_NAME);
    }
    return null;
  }

  const expiresAt = new Date(parsed.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt.valueOf())) {
    store.delete(SESSION_CACHE_COOKIE_NAME);
    return null;
  }

  const remaining = expiresAt.getTime() - Date.now();
  if (remaining <= SESSION_CACHE_MIN_TTL_MS) {
    return null;
  }

  return parsed;
}

async function cacheSessionPayload(payload: SessionPayload): Promise<void> {
  const exp = decodeJwtExpiration(payload.accessToken);
  if (!exp) {
    await clearCachedSession();
    return;
  }

  const expiresAt = new Date(exp * 1000);
  if (expiresAt.getTime() <= Date.now()) {
    await clearCachedSession();
    return;
  }

  const store = await cookies();
  const cached: CachedSessionCookie = {
    payload,
    accessTokenExpiresAt: expiresAt.toISOString(),
  };

  store.set({
    name: SESSION_CACHE_COOKIE_NAME,
    value: Buffer.from(JSON.stringify(cached), "utf8").toString("base64url"),
    expires: expiresAt,
    ...SESSION_COOKIE_OPTIONS,
  });
}

export type RefreshSessionResult = {
  accessToken: string;
  payload: SessionPayload;
  cookies: readonly string[];
};

export async function refreshAccessTokenFromCookies(): Promise<RefreshSessionResult> {
  const cached = await readCachedSession();
  if (cached) {
    return {
      accessToken: cached.payload.accessToken,
      payload: cached.payload,
      cookies: [],
    };
  }

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
    await clearCachedSession();
    throw new Error(`Failed to refresh session: ${response.status}`);
  }

  const payload = (await response.json()) as SessionPayload;
  const cookies = extractSetCookieHeaders(response);

  if (cookies.length > 0) {
    await applyBackendCookies(cookies);
  }

  await cacheSessionPayload(payload);

  return {
    accessToken: payload.accessToken,
    payload,
    cookies
  };
}
