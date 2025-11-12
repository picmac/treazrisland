import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@lib/api/client", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

import type { HeaderGetter } from "@/src/lib/api/client";
import { login } from "@/src/lib/api/auth";

describe("login", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("forwards server request headers to apiFetch", async () => {
    const headerStore = { get: vi.fn() } as unknown as HeaderGetter;
    const payload = {
      identifier: "captain",
      password: "Secret123",
      mfaCode: "123456",
      recoveryCode: "rc-1",
    };

    apiFetchMock.mockResolvedValueOnce({
      accessToken: "token",
      refreshExpiresAt: "future",
      user: { id: "1", email: "captain@treaz", nickname: "captain", role: "PLAYER" },
    });

    await login(payload, { requestHeaders: headerStore });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({
        method: "POST",
        requestHeaders: headerStore,
      })
    );
  });
});
