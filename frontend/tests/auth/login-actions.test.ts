import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/src/lib/api/auth", () => ({
  loginWithCookies: vi.fn()
}));

vi.mock("@/src/lib/server/backend-cookies", () => ({
  applyBackendCookies: vi.fn(),
  buildCookieHeaderFromStore: vi.fn()
}));

vi.mock("next/headers", () => ({
  headers: vi.fn()
}));

import { ApiError } from "@/src/lib/api/client";
import type { HeaderGetter } from "@/src/lib/api/client";
import { loginWithCookies } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore
} from "@/src/lib/server/backend-cookies";
import { performLogin } from "@/app/(auth)/login/actions";
import { headers } from "next/headers";

describe("performLogin", () => {
  let headerStore: HeaderGetter;

  beforeEach(() => {
    vi.mocked(headers).mockReset();
    headerStore = { get: vi.fn() } as HeaderGetter;
    vi.mocked(headers).mockReturnValue(headerStore as unknown as Headers);
    vi.mocked(loginWithCookies).mockReset();
    vi.mocked(applyBackendCookies).mockReset();
    vi.mocked(buildCookieHeaderFromStore).mockReset();
  });

  it("forwards cookies and returns success payload", async () => {
    vi.mocked(buildCookieHeaderFromStore).mockResolvedValue("treaz_refresh=abc");
    vi.mocked(loginWithCookies).mockResolvedValue({
      payload: {
        accessToken: "token",
        refreshExpiresAt: "future",
        user: { id: "1", email: "captain@treaz", nickname: "captain", role: "PLAYER" }
      },
      cookies: ["treaz_refresh=abc; Path=/; HttpOnly"]
    });

    const result = await performLogin({ identifier: "captain", password: "Secret123" });

    expect(loginWithCookies).toHaveBeenCalledWith(
      { identifier: "captain", password: "Secret123" },
      expect.objectContaining({
        cookieHeader: "treaz_refresh=abc",
        requestHeaders: headerStore
      })
    );
    expect(applyBackendCookies).toHaveBeenCalledWith([
      "treaz_refresh=abc; Path=/; HttpOnly"
    ]);
    expect(result).toEqual({
      success: true,
      payload: {
        accessToken: "token",
        refreshExpiresAt: "future",
        user: { id: "1", email: "captain@treaz", nickname: "captain", role: "PLAYER" }
      }
    });
  });

  it("surfaces MFA challenge errors", async () => {
    vi.mocked(buildCookieHeaderFromStore).mockResolvedValue(undefined);
    vi.mocked(loginWithCookies).mockRejectedValue(
      new ApiError("MFA challenge required", 401, { message: "MFA challenge required", mfaRequired: true })
    );

    const result = await performLogin({ identifier: "captain", password: "Secret123" });

    expect(result).toEqual({
      success: false,
      error: "MFA challenge required",
      mfaRequired: true
    });
    expect(loginWithCookies).toHaveBeenCalledWith(
      { identifier: "captain", password: "Secret123" },
      expect.objectContaining({ requestHeaders: headerStore })
    );
    expect(applyBackendCookies).not.toHaveBeenCalled();
  });

  it("handles unexpected exceptions", async () => {
    vi.mocked(loginWithCookies).mockRejectedValue(new Error("network down"));

    const result = await performLogin({ identifier: "captain", password: "Secret123" });

    expect(result).toEqual({ success: false, error: "network down" });
    expect(loginWithCookies).toHaveBeenCalledWith(
      { identifier: "captain", password: "Secret123" },
      expect.objectContaining({ requestHeaders: headerStore })
    );
  });
});
