import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  get: vi.fn<(name: string) => { value: string } | undefined>(),
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
    buildCookieHeaderFromStore: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => cookieStore,
}));

import { resolveApiBase } from "@/src/lib/api/client";
import { buildCookieHeaderFromStore } from "@/src/lib/server/backend-cookies";
import { refreshAccessTokenFromCookies } from "@/src/lib/server/session";

const mockResolveApiBase = vi.mocked(resolveApiBase);
const mockBuildCookieHeaderFromStore = vi.mocked(buildCookieHeaderFromStore);
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
    cookieStore.get.mockReset();
    mockBuildCookieHeaderFromStore.mockResolvedValue(undefined);
    cookieStore.get.mockReturnValue(undefined);
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

    const responseBody = {
      accessToken: "new-access",
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
      accessToken: "new-access",
      payload: responseBody,
      cookies: ["treaz_refresh=new-token; Path=/; HttpOnly"],
    });
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
  });
});
