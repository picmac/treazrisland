import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
}));

vi.mock("@/src/lib/api/auth", () => ({
  startMfaSetup: vi.fn(),
  confirmMfaSetup: vi.fn(),
  disableMfa: vi.fn(),
}));

import {
  startMfaSetup,
  confirmMfaSetup,
  disableMfa,
} from "@/src/lib/api/auth";
import { MfaSettingsPanel } from "./mfa-settings";

const mockedStart = vi.mocked(startMfaSetup);
const mockedConfirm = vi.mocked(confirmMfaSetup);
const mockedDisable = vi.mocked(disableMfa);

describe("MfaSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts setup and displays recovery codes", async () => {
    mockedStart.mockResolvedValueOnce({
      secretId: "secret-1",
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/TREAZRISLAND:player%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TREAZRISLAND",
      recoveryCodes: ["CODE-1", "CODE-2", "CODE-3", "CODE-4"],
    });

    render(<MfaSettingsPanel initialEnabled={false} accountEmail="player@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());
    expect(await screen.findByText(/CODE-1/)).toBeInTheDocument();
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument();
  });

  it("confirms the MFA secret", async () => {
    mockedStart.mockResolvedValueOnce({
      secretId: "secret-1",
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/TREAZRISLAND:player%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TREAZRISLAND",
      recoveryCodes: ["CODE-1"],
    });
    mockedConfirm.mockResolvedValueOnce({ message: "ok" });

    render(<MfaSettingsPanel initialEnabled={false} accountEmail="player@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));
    await waitFor(() => expect(mockedStart).toHaveBeenCalled());

    const input = await screen.findByLabelText(/enter the current mfa code/i);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm mfa/i }));

    await waitFor(() => expect(mockedConfirm).toHaveBeenCalledWith({ secretId: "secret-1", code: "123456" }));
    expect(await screen.findByText(/MFA enabled/i)).toBeInTheDocument();
  });

  it("disables MFA with a code", async () => {
    mockedDisable.mockResolvedValueOnce({ message: "disabled" });

    render(<MfaSettingsPanel initialEnabled accountEmail="player@example.com" />);

    const input = screen.getByLabelText(/MFA code/i);
    fireEvent.change(input, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /disable mfa/i }));

    await waitFor(() => expect(mockedDisable).toHaveBeenCalledWith({ mfaCode: "654321" }));
    expect(screen.getByText(/MFA disabled/i)).toBeInTheDocument();
  });
});
