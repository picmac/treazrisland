import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/api/client", () => ({
  resolveApiBase: vi.fn(),
}));

vi.mock("@/src/lib/server/session", () => ({
  refreshAccessTokenFromCookies: vi.fn(),
}));

vi.mock("@/src/lib/server/backend-cookies", () => ({
  applyBackendCookies: vi.fn(),
  extractSetCookieHeaders: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

import { resolveApiBase } from "@/src/lib/api/client";
import { refreshAccessTokenFromCookies } from "@/src/lib/server/session";
import {
  applyBackendCookies,
  extractSetCookieHeaders,
} from "@/src/lib/server/backend-cookies";
import { redirect } from "next/navigation";
import { fetchProfile } from "./fetch-profile";

const mockResolveApiBase = vi.mocked(resolveApiBase);
const mockRefreshAccessTokenFromCookies = vi.mocked(refreshAccessTokenFromCookies);
const mockApplyBackendCookies = vi.mocked(applyBackendCookies);
const mockExtractSetCookieHeaders = vi.mocked(extractSetCookieHeaders);
const mockRedirect = vi.mocked(redirect);

const fetchMock = vi.fn<
  Parameters<typeof fetch>,
  Promise<Response>
>();

const redirectError = (path: string) => {
  const error = new Error(`REDIRECT:${path}`);
  (error as Error & { digest?: string }).digest = "NEXT_REDIRECT";
  throw error;
};

describe("fetchProfile", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockResolveApiBase.mockClear();
    mockResolveApiBase.mockReturnValue("http://backend.test");
    mockRefreshAccessTokenFromCookies.mockReset();
    mockApplyBackendCookies.mockReset();
    mockExtractSetCookieHeaders.mockReset();
    mockRedirect.mockReset();
    mockRedirect.mockImplementation(redirectError);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a refreshed access token when requesting the profile", async () => {
    mockRefreshAccessTokenFromCookies.mockResolvedValue({
      accessToken: "fresh-token",
      payload: {
        accessToken: "fresh-token",
        refreshExpiresAt: "2099-01-01T00:00:00Z",
        user: {
          id: "user-1",
          email: "pirate@island.tld",
          nickname: "Pirate",
          role: "USER",
        },
      },
      cookies: ["treaz_refresh=new-token; Path=/; HttpOnly"],
    });

    mockExtractSetCookieHeaders.mockReturnValueOnce([
      "treaz_session=profile-token; Path=/; HttpOnly",
    ]);

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "pirate@island.tld", nickname: "Pirate", role: "USER" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const response = await fetchProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/users/me");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer fresh-token",
    });

    expect(response).toEqual({
      user: { id: "user-1", email: "pirate@island.tld", nickname: "Pirate", role: "USER" },
    });

    expect(mockApplyBackendCookies).toHaveBeenCalledTimes(2);
    expect(mockApplyBackendCookies).toHaveBeenNthCalledWith(1, [
      "treaz_refresh=new-token; Path=/; HttpOnly",
    ]);
    expect(mockApplyBackendCookies).toHaveBeenNthCalledWith(2, [
      "treaz_session=profile-token; Path=/; HttpOnly",
    ]);
  });

  it("redirects to /login when the profile request is unauthorized", async () => {
    mockRefreshAccessTokenFromCookies.mockResolvedValue({
      accessToken: "fresh-token",
      payload: {
        accessToken: "fresh-token",
        refreshExpiresAt: "2099-01-01T00:00:00Z",
        user: {
          id: "user-1",
          email: "pirate@island.tld",
          nickname: "Pirate",
          role: "USER",
        },
      },
      cookies: ["treaz_refresh=new-token; Path=/; HttpOnly"],
    });

    mockExtractSetCookieHeaders.mockReturnValueOnce([
      "treaz_session=profile-token; Path=/; HttpOnly",
    ]);

    fetchMock.mockResolvedValue(
      new Response("unauthorized", {
        status: 401,
        headers: { "content-type": "text/plain" },
      })
    );

    await expect(fetchProfile()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockApplyBackendCookies).toHaveBeenCalledTimes(2);
    expect(mockApplyBackendCookies).toHaveBeenNthCalledWith(1, [
      "treaz_refresh=new-token; Path=/; HttpOnly",
    ]);
    expect(mockApplyBackendCookies).toHaveBeenNthCalledWith(2, [
      "treaz_session=profile-token; Path=/; HttpOnly",
    ]);
  });

  it("redirects to /login when the refresh call fails", async () => {
    mockRefreshAccessTokenFromCookies.mockRejectedValue(
      new Error("session expired")
    );

    await expect(fetchProfile()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
