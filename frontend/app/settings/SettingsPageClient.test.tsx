import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/api/user", () => ({
  updateUserProfile: vi.fn(),
}));

vi.mock("@/src/auth/mfa-settings", () => ({
  MfaSettingsPanel: ({ initialEnabled }: { initialEnabled: boolean }) => (
    <div data-testid="mfa-panel">{initialEnabled ? "mfa-on" : "mfa-off"}</div>
  ),
}));

import type { UserProfile } from "@/src/lib/api/user";
import { updateUserProfile } from "@/src/lib/api/user";
import { ApiError } from "@/src/lib/api/client";
import SettingsPageClient from "./SettingsPageClient";

describe("SettingsPageClient", () => {
  const baseProfile: UserProfile = {
    id: "user_1",
    email: "player@example.com",
    nickname: "pirate",
    displayName: "Pirate",
    role: "USER",
    avatar: {
      storageKey: "avatars/user_1/avatar.png",
      mimeType: "image/png",
      fileSize: 1024,
      updatedAt: "2025-01-01T00:00:00.000Z",
      url: "/users/me/avatar?v=123",
      signedUrlExpiresAt: null,
      fallbackPath: "/users/me/avatar?v=123",
    },
    mfaEnabled: false,
  };

  it("submits profile changes", async () => {
    vi.mocked(updateUserProfile).mockResolvedValueOnce({
      user: { ...baseProfile, nickname: "captain" },
    });

    render(<SettingsPageClient initialProfile={baseProfile} />);

    const nicknameInput = screen.getByLabelText(/nickname/i);
    fireEvent.change(nicknameInput, { target: { value: "captain " } });

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: "captain" }),
      );
    });

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
  });

  it("displays API validation errors", async () => {
    vi.mocked(updateUserProfile).mockRejectedValueOnce(
      new ApiError("Invalid", 400, { errors: { nickname: ["Nickname taken"] } }),
    );

    render(<SettingsPageClient initialProfile={baseProfile} />);

    const nicknameInput = screen.getByLabelText(/nickname/i);
    fireEvent.change(nicknameInput, { target: { value: "captain" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/Nickname taken/i)).toBeInTheDocument();
  });

  it("flags avatar removal when requested", async () => {
    vi.mocked(updateUserProfile).mockResolvedValueOnce({
      user: { ...baseProfile, avatar: null },
    });

    render(<SettingsPageClient initialProfile={baseProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /remove avatar/i }));
    expect(screen.getByText(/will be removed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({ removeAvatar: true }),
      );
    });
  });
});
