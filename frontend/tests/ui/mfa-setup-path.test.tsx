import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
}));

vi.mock("@/src/lib/api/user", () => ({
  updateUserProfile: vi.fn(),
}));

vi.mock("@/src/lib/api/auth", () => ({
  startMfaSetup: vi.fn(),
  confirmMfaSetup: vi.fn(),
  disableMfa: vi.fn(),
}));

import type { UserProfile } from "@/src/lib/api/user";
import { startMfaSetup, confirmMfaSetup } from "@/src/lib/api/auth";
import SettingsPageClient from "@/app/settings/SettingsPageClient";

const mockedStart = vi.mocked(startMfaSetup);
const mockedConfirm = vi.mocked(confirmMfaSetup);

describe("settings MFA setup path", () => {
  const profile: UserProfile = {
    id: "user_1",
    email: "player@example.com",
    nickname: "deckhand",
    displayName: "Deckhand",
    role: "USER",
    avatar: null,
    mfaEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("walks through the MFA enablement flow from the settings page", async () => {
    mockedStart.mockResolvedValueOnce({
      secretId: "secret-1",
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/TREAZRISLAND:player@example.com?secret=JBSWY3DPEHPK3PXP",
      recoveryCodes: ["CODE-1", "CODE-2"],
    });
    mockedConfirm.mockResolvedValueOnce({ message: "enabled" });

    render(<SettingsPageClient initialProfile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());

    expect(await screen.findByText(/CODE-1/)).toBeInTheDocument();
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument();
    expect(screen.getAllByText(/player@example.com/).length).toBeGreaterThan(0);

    const codeInput = await screen.findByLabelText(/enter the current mfa code/i);
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm mfa/i }));

    await waitFor(() =>
      expect(mockedConfirm).toHaveBeenCalledWith({ secretId: "secret-1", code: "123456" }),
    );
    expect(screen.getByText(/MFA enabled/i)).toBeInTheDocument();
  });
});
