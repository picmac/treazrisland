import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/src/lib/api/auth", () => ({
  redeemInvitation: vi.fn()
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
import { redeemInvitation } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore
} from "@/src/lib/server/backend-cookies";
import { redeemInvitationAction } from "@/app/(auth)/signup/actions";
import { headers } from "next/headers";

describe("redeemInvitationAction", () => {
  let headerStore: HeaderGetter;

  beforeEach(() => {
    vi.mocked(headers).mockReset();
    headerStore = { get: vi.fn() } as HeaderGetter;
    vi.mocked(headers).mockReturnValue(headerStore as unknown as Headers);
    vi.mocked(redeemInvitation).mockReset();
    vi.mocked(applyBackendCookies).mockReset();
    vi.mocked(buildCookieHeaderFromStore).mockReset();
    vi.mocked(buildCookieHeaderFromStore).mockResolvedValue(undefined);
  });

  it("passes through invitation payload", async () => {
    vi.mocked(buildCookieHeaderFromStore).mockResolvedValue("treaz_refresh=abc");
    vi.mocked(redeemInvitation).mockResolvedValue({
      payload: {
        accessToken: "token",
        refreshExpiresAt: "future",
        user: { id: "1", email: "crew@example.com", nickname: "crew", role: "PLAYER" }
      },
      cookies: ["treaz_refresh=abc; Path=/; HttpOnly"]
    });

    const result = await redeemInvitationAction({
      token: "token-abc",
      email: "crew@example.com",
      nickname: "crew",
      password: "Password1",
      displayName: "Crew"
    });

    expect(redeemInvitation).toHaveBeenCalledWith(
      {
        token: "token-abc",
        email: "crew@example.com",
        nickname: "crew",
        password: "Password1",
        displayName: "Crew"
      },
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
        user: { id: "1", email: "crew@example.com", nickname: "crew", role: "PLAYER" }
      }
    });
  });

  it("handles API validation errors", async () => {
    vi.mocked(redeemInvitation).mockRejectedValue(
      new ApiError("nickname taken", 409, { message: "nickname taken" })
    );

    const result = await redeemInvitationAction({
      token: "token-abc",
      nickname: "crew",
      password: "Password1"
    });

    expect(result).toEqual({ success: false, error: "nickname taken" });
    expect(applyBackendCookies).not.toHaveBeenCalled();
    expect(redeemInvitation).toHaveBeenCalledWith(
      {
        token: "token-abc",
        email: undefined,
        nickname: "crew",
        password: "Password1",
        displayName: "crew"
      },
      expect.objectContaining({ requestHeaders: headerStore })
    );
  });

  it("coalesces unknown errors", async () => {
    vi.mocked(redeemInvitation).mockRejectedValue(new Error("network"));

    const result = await redeemInvitationAction({
      token: "token-abc",
      nickname: "crew",
      password: "Password1"
    });

    expect(result).toEqual({ success: false, error: "network" });
    expect(redeemInvitation).toHaveBeenCalledWith(
      {
        token: "token-abc",
        email: undefined,
        nickname: "crew",
        password: "Password1",
        displayName: "crew"
      },
      expect.objectContaining({ requestHeaders: headerStore })
    );
  });
});
