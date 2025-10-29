import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@lib/api/client", () => {
  return {
    apiFetch: vi.fn()
  };
});

import { apiFetch } from "@lib/api/client";
import { previewInvitation, signupWithInvitation, createInvitation, listInvitations } from "./invitations";

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
