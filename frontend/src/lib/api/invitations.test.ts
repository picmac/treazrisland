import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@lib/api/client", () => {
  return {
    apiFetch: vi.fn()
  };
});

import { apiFetch } from "@lib/api/client";
import { previewInvitation, signupWithInvitation } from "./invitations";

describe("invitation api helpers", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("calls preview endpoint with token", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ invitation: { role: "USER", email: "test@example.com" } });

    await previewInvitation("token-123");

    expect(apiFetch).toHaveBeenCalledWith(
      "/auth/invitations/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token-123" })
      })
    );
  });

  it("posts signup payload", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user: { id: "1", email: "a", nickname: "b", role: "USER" } });

    await signupWithInvitation({
      token: "token-abc",
      email: "player@example.com",
      nickname: "player",
      password: "Password1",
      displayName: "Player"
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "token-abc",
          email: "player@example.com",
          nickname: "player",
          password: "Password1",
          displayName: "Player"
        })
      })
    );
  });
});
