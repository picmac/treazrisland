import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/api/client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@lib/api/client";
import {
  getCurrentUserProfile,
  updateUserProfile,
} from "./user";

describe("user profile api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetches the current user profile", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user: { id: "user_1" } });

    await getCurrentUserProfile();

    expect(apiFetch).toHaveBeenCalledWith("/users/me", expect.objectContaining({ method: "GET" }));
  });

  it("sends json payloads when no avatar is provided", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user: { id: "user_1" } });

    await updateUserProfile({ nickname: "captain", displayName: "Captain" });

    expect(apiFetch).toHaveBeenCalledWith(
      "/users/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ nickname: "captain", displayName: "Captain" }),
      }),
    );
  });

  it("includes removeAvatar flag when requested", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user: { id: "user_1" } });

    await updateUserProfile({ removeAvatar: true });

    expect(apiFetch).toHaveBeenCalledWith(
      "/users/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ removeAvatar: true }),
      }),
    );
  });

  it("uses multipart form data when uploading avatars", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user: { id: "user_1" } });
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await updateUserProfile({ displayName: "Pirate", avatarFile: file });

    expect(apiFetch).toHaveBeenCalled();
    const [, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBeInstanceOf(FormData);
    const formData = init?.body as FormData;
    expect(formData.get("displayName")).toBe("Pirate");
    expect(formData.get("avatar")).toBe(file);
  });
});
