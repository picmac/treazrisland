import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  get: vi.fn<(name: string) => { value: string } | undefined>(),
  set: vi.fn<(
    value:
      | { name: string; value: string; httpOnly?: boolean; sameSite?: string; secure?: boolean; path?: string; expires?: Date }
      | string,
    valueMaybe?: string,
  ) => void>(),
  delete: vi.fn<(name: string) => void>(),
  getAll: vi.fn<() => { name: string; value: string }[]>(),
};

vi.mock("@/src/lib/api/client", () => ({
  resolveApiBase: vi.fn(),
}));

vi.mock("@/src/lib/server/backend-cookies", async () => {
  const actual = await vi.importActual<
    typeof import("@/src/lib/server/backend-cookies")
  >("@/src/lib/server/backend-cookies");

  return {
    ...actual,
    applyBackendCookies: vi.fn(),
    buildCookieHeaderFromStore: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => cookieStore,
}));

import { resolveApiBase } from "@/src/lib/api/client";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore,
} from "@/src/lib/server/backend-cookies";
import { refreshAccessTokenFromCookies } from "@/src/lib/server/session";
import type { SessionPayload } from "@/src/lib/api/auth";

const mockResolveApiBase = vi.mocked(resolveApiBase);
const mockBuildCookieHeaderFromStore = vi.mocked(buildCookieHeaderFromStore);
const mockApplyBackendCookies = vi.mocked(applyBackendCookies);
const fetchMock = vi.fn<
  Parameters<typeof fetch>,
  Promise<Response>
>();

describe("refreshAccessTokenFromCookies", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockResolveApiBase.mockClear();
    mockResolveApiBase.mockReturnValue("http://backend.test");
    mockBuildCookieHeaderFromStore.mockReset();
    mockApplyBackendCookies.mockReset();
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.getAll.mockReset();
    mockBuildCookieHeaderFromStore.mockResolvedValue(undefined);
    cookieStore.get.mockReturnValue(undefined);
    cookieStore.getAll.mockReturnValue([]);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends cookies and csrf token to the refresh endpoint", async () => {
    mockBuildCookieHeaderFromStore.mockResolvedValue("treaz_refresh=old-token");
    cookieStore.get.mockImplementation((name) =>
      name === "treaz_refresh_csrf" ? { value: "csrf-token" } : undefined
    );

    const newAccessToken = createJwt(Math.floor(Date.now() / 1000) + 900);
    const responseBody = {
      accessToken: newAccessToken,
      refreshExpiresAt: "2099-01-01T00:00:00Z",
      user: { id: "user-1", email: "pirate@island.tld", nickname: "Pirate", role: "USER" },
    };

    const responseHeaders = {
      get: (name: string) => {
        const normalized = name.toLowerCase();
        if (normalized === "content-type") {
          return "application/json";
        }
        if (normalized === "set-cookie") {
          return "treaz_refresh=new-token; Path=/; HttpOnly";
        }
        return null;
      },
      getSetCookie: () => ["treaz_refresh=new-token; Path=/; HttpOnly"],
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: responseHeaders,
      json: async () => responseBody,
    } as unknown as Response);

    const payload = await refreshAccessTokenFromCookies();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/auth/refresh");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toBeInstanceOf(Headers);

    const headers = init?.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("cookie")).toBe("treaz_refresh=old-token");
    expect(headers.get("x-refresh-csrf")).toBe("csrf-token");

    expect(payload).toEqual({
      accessToken: newAccessToken,
      payload: responseBody,
      cookies: ["treaz_refresh=new-token; Path=/; HttpOnly"],
    });

    expect(mockApplyBackendCookies).toHaveBeenCalledTimes(1);
    expect(mockApplyBackendCookies).toHaveBeenCalledWith([
      "treaz_refresh=new-token; Path=/; HttpOnly",
    ]);

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [cookieArg] = cookieStore.set.mock.calls[0];
    expect(cookieArg).toEqual(
      expect.objectContaining({
        name: "treaz_session",
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      })
    );

    const cachedValue = Buffer.from((cookieArg as { value: string }).value, "base64url").toString("utf8");
    const parsed = JSON.parse(cachedValue) as { payload: SessionPayload; accessTokenExpiresAt: string };
    expect(parsed.payload.accessToken).toBe(newAccessToken);
  });

  it("throws when the refresh endpoint fails", async () => {
    fetchMock.mockResolvedValue(
      new Response("nope", {
        status: 401,
        headers: { "content-type": "text/plain" },
      })
    );

    await expect(refreshAccessTokenFromCookies()).rejects.toThrow(
      "Failed to refresh session: 401"
    );

    expect(cookieStore.delete).toHaveBeenCalledWith("treaz_session");
  });

  it("reuses a cached session when the access token is still valid", async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const accessToken = createJwt(exp);
    const cachedValue = encodeCachedSession({
      accessToken,
      refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {
        id: "user-1",
        email: "pirate@island.tld",
        nickname: "Pirate",
        role: "USER",
      },
    });

    cookieStore.get.mockImplementation((name: string) => {
      if (name === "treaz_session") {
        return { value: cachedValue };
      }
      return undefined;
    });

    const payload = await refreshAccessTokenFromCookies();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload).toEqual({
      accessToken,
      payload: {
        accessToken,
        refreshExpiresAt: expect.any(String),
        user: expect.objectContaining({ id: "user-1" }),
      },
      cookies: [],
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("refreshes when the cached access token is near expiry", async () => {
    const exp = Math.floor(Date.now() / 1000) + 5;
    const staleAccessToken = createJwt(exp);
    const cachedValue = encodeCachedSession({
      accessToken: staleAccessToken,
      refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {
        id: "user-1",
        email: "pirate@island.tld",
        nickname: "Pirate",
        role: "USER",
      },
    });

    cookieStore.get.mockImplementation((name: string) => {
      if (name === "treaz_session") {
        return { value: cachedValue };
      }
      if (name === "treaz_refresh_csrf") {
        return { value: "csrf-token" };
      }
      return undefined;
    });

    mockBuildCookieHeaderFromStore.mockResolvedValue("treaz_refresh=old-token");

    const responseBody = {
      accessToken: createJwt(Math.floor(Date.now() / 1000) + 900),
      refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: { id: "user-1", email: "pirate@island.tld", nickname: "Pirate", role: "USER" },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "content-type") {
            return "application/json";
          }
          return null;
        },
        getSetCookie: () => [],
      },
      json: async () => responseBody,
    } as unknown as Response);

    const payload = await refreshAccessTokenFromCookies();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.accessToken).toBe(responseBody.accessToken);
    expect(cookieStore.set).toHaveBeenCalled();
  });
});

function createJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `${header}.${payload}.signature`;
}

function encodeCachedSession(payload: SessionPayload): string {
  const exp = decodeJwtPayload(payload.accessToken)?.exp ?? Math.floor(Date.now() / 1000) + 900;
  const cached = {
    payload,
    accessTokenExpiresAt: new Date(exp * 1000).toISOString(),
  };
  return Buffer.from(JSON.stringify(cached), "utf8").toString("base64url");
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }
  try {
    const decoded = Buffer.from(segments[1], "base64url").toString("utf8");
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
}
