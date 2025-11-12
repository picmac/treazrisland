import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/api/auth", () => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordResetWithCookies: vi.fn(),
}));

vi.mock("@/src/lib/server/backend-cookies", () => ({
  applyBackendCookies: vi.fn(),
  buildCookieHeaderFromStore: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import type { HeaderGetter } from "@/src/lib/api/client";
import { requestPasswordReset, confirmPasswordResetWithCookies } from "@/src/lib/api/auth";
import { applyBackendCookies, buildCookieHeaderFromStore } from "@/src/lib/server/backend-cookies";
import { submitPasswordResetRequest } from "@/app/(auth)/password/reset/request/actions";
import { confirmPasswordResetAction } from "@/app/(auth)/password/reset/confirm/actions";
import { headers } from "next/headers";

describe("submitPasswordResetRequest", () => {
  let headerStore: HeaderGetter;

  beforeEach(() => {
    vi.mocked(headers).mockReset();
    headerStore = { get: vi.fn() } as HeaderGetter;
    vi.mocked(headers).mockReturnValue(headerStore as unknown as Headers);
    vi.mocked(requestPasswordReset).mockReset();
  });

  it("forwards the request headers to the API helper", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({
      message: "Reset email sent",
    });

    const result = await submitPasswordResetRequest({ email: "  pirate@example.com " });

    expect(result).toEqual({ success: true, message: "Reset email sent" });
    expect(requestPasswordReset).toHaveBeenCalledWith("pirate@example.com", headerStore);
  });
});

describe("confirmPasswordResetAction", () => {
  let headerStore: HeaderGetter;

  beforeEach(() => {
    vi.mocked(headers).mockReset();
    headerStore = { get: vi.fn() } as HeaderGetter;
    vi.mocked(headers).mockReturnValue(headerStore as unknown as Headers);
    vi.mocked(applyBackendCookies).mockReset();
    vi.mocked(buildCookieHeaderFromStore).mockReset();
    vi.mocked(confirmPasswordResetWithCookies).mockReset();
  });

  it("includes the header store when requesting confirmation", async () => {
    vi.mocked(buildCookieHeaderFromStore).mockResolvedValue("treaz_session=abc");
    vi.mocked(confirmPasswordResetWithCookies).mockResolvedValue({
      payload: {
        accessToken: "access",
        refreshExpiresAt: "future",
        user: {
          id: "user_1",
          email: "player@example.com",
          nickname: "player",
          role: "PLAYER",
        },
      },
      cookies: ["treaz_session=abc; Path=/; HttpOnly"],
    });

    const result = await confirmPasswordResetAction({ token: "token", password: "Secret123" });

    expect(confirmPasswordResetWithCookies).toHaveBeenCalledWith(
      { token: "token", password: "Secret123" },
      expect.objectContaining({
        cookieHeader: "treaz_session=abc",
        requestHeaders: headerStore,
      }),
    );
    expect(applyBackendCookies).toHaveBeenCalledWith(["treaz_session=abc; Path=/; HttpOnly"]);
    expect(result).toEqual({
      success: true,
      payload: {
        accessToken: "access",
        refreshExpiresAt: "future",
        user: {
          id: "user_1",
          email: "player@example.com",
          nickname: "player",
          role: "PLAYER",
        },
      },
    });
  });
});
