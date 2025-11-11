import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/api/user", () => ({
  updateUserProfile: vi.fn(),
  deleteCurrentUser: vi.fn(),
}));

vi.mock("@/src/lib/api/auth", () => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/src/auth/mfa-settings", () => ({
  MfaSettingsPanel: ({ initialEnabled }: { initialEnabled: boolean }) => (
    <div data-testid="mfa-panel">{initialEnabled ? "mfa-on" : "mfa-off"}</div>
  ),
}));

import type { UserProfile } from "@/src/lib/api/user";
import { deleteCurrentUser, updateUserProfile } from "@/src/lib/api/user";
import { ApiError } from "@/src/lib/api/client";
import { requestPasswordReset } from "@/src/lib/api/auth";
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

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

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

  it("requests a password reset and surfaces the response", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      message: "Reset email dispatched",
    });

    render(<SettingsPageClient initialProfile={baseProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith(baseProfile.email);
    });

    expect(
      await screen.findByText(/reset email dispatched/i),
    ).toBeInTheDocument();
  });

  it("shows password reset errors", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValueOnce(
      new ApiError("Server exploded", 500, { message: "boom" }),
    );

    render(<SettingsPageClient initialProfile={baseProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      await screen.findByText(/500: server exploded/i),
    ).toBeInTheDocument();
  });

  it("persists notification toggles to localStorage", async () => {
    render(<SettingsPageClient initialProfile={baseProfile} />);

    const checkbox = screen.getByLabelText(/email sign-in alerts/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    await waitFor(() => {
      const stored = window.localStorage.getItem("treaz.settings.notifications");
      expect(stored).toBeTruthy();
      const parsed = stored ? JSON.parse(stored) : {};
      expect(parsed).toMatchObject({ emailAlerts: false });
    });

    expect(
      await screen.findByText(/notification preferences saved locally/i),
    ).toBeInTheDocument();
  });

  it("confirms account deletion before calling the API", async () => {
    vi.mocked(deleteCurrentUser).mockResolvedValueOnce({
      message: "Account deleted",
    });

    render(<SettingsPageClient initialProfile={baseProfile} />);

    const confirmInput = screen.getByLabelText(/confirm account deletion/i);
    fireEvent.change(confirmInput, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    await waitFor(() => {
      expect(deleteCurrentUser).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText(/account deleted/i),
    ).toBeInTheDocument();
  });
});
