import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@lib/api/client", () => ({
  apiFetch: vi.fn()
}));

vi.mock("./auth", () => ({
  signupWithInvitation: vi.fn()
}));

import { apiFetch } from "@lib/api/client";
import { signupWithInvitation as signupThroughAuth } from "./auth";
import { previewInvitation, signupWithInvitation, createInvitation, listInvitations } from "./invitations";

describe("invitation api helpers", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(signupThroughAuth).mockReset();
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
    vi.mocked(signupThroughAuth).mockResolvedValueOnce({
      accessToken: "token",
      refreshExpiresAt: "future",
      user: { id: "1", email: "a", nickname: "b", role: "USER" }
    });

    const result = await signupWithInvitation({
      token: "token-abc",
      email: "player@example.com",
      nickname: "player",
      password: "Password1",
      displayName: "Player"
    });

    expect(signupThroughAuth).toHaveBeenCalledWith({
      token: "token-abc",
      email: "player@example.com",
      nickname: "player",
      password: "Password1",
      displayName: "Player"
    });
    expect(result).toEqual({
      accessToken: "token",
      refreshExpiresAt: "future",
      user: { id: "1", email: "a", nickname: "b", role: "USER" }
    });
  });

  it("creates an invitation", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      invitation: {
        id: "invite_1",
        role: "USER",
        email: "guest@example.com",
        expiresAt: "2025-01-02T00:00:00.000Z",
        redeemedAt: null,
        createdAt: "2025-01-01T00:00:00.000Z"
      },
      token: "token"
    });

    await createInvitation({ email: "guest@example.com", role: "USER", expiresInHours: 12 });

    expect(apiFetch).toHaveBeenCalledWith(
      "/users/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "guest@example.com", role: "USER", expiresInHours: 12 })
      })
    );
  });

  it("fetches invitation list", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ invitations: [] });

    await listInvitations();

    expect(apiFetch).toHaveBeenCalledWith(
      "/users/invitations",
      expect.objectContaining({
        method: "GET"
      })
    );
  });
});
