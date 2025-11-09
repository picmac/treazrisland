import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, type MockedFunction } from "vitest";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";
import { PasswordResetConfirmForm } from "@/components/auth/password-reset-confirm-form";

vi.mock("@/app/(auth)/password/reset/request/actions", () => ({
  submitPasswordResetRequest: vi.fn(),
}));

vi.mock("@/app/(auth)/password/reset/confirm/actions", () => ({
  confirmPasswordResetAction: vi.fn(),
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/src/auth/session-provider", () => ({
  useSession: vi.fn(),
}));

import { submitPasswordResetRequest } from "@/app/(auth)/password/reset/request/actions";
import { confirmPasswordResetAction } from "@/app/(auth)/password/reset/confirm/actions";
import { useSession, type AuthContextValue } from "@/src/auth/session-provider";

const submitPasswordResetRequestMock = submitPasswordResetRequest as MockedFunction<
  typeof submitPasswordResetRequest
>;
const confirmPasswordResetActionMock = confirmPasswordResetAction as MockedFunction<
  typeof confirmPasswordResetAction
>;
const useSessionMock = useSession as unknown as MockedFunction<typeof useSession>;

function createSession(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    accessToken: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    ...overrides,
  };
}

describe("password reset forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates email before submitting the reset request", async () => {
    submitPasswordResetRequestMock.mockResolvedValue({
      success: true,
      message: "If the account exists we sent reset instructions.",
    });

    render(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "invalid-email" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/Enter a valid email to continue\./i),
      ).toBeInTheDocument();
    });
    expect(submitPasswordResetRequestMock).not.toHaveBeenCalled();
  });

  it("submits the reset request and shows confirmation", async () => {
    submitPasswordResetRequestMock.mockResolvedValue({
      success: true,
      message: "If the account exists we sent reset instructions.",
    });

    render(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "crew@treazrisland.test" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form")!);

    await waitFor(() => {
      expect(submitPasswordResetRequestMock).toHaveBeenCalledWith({
        email: "crew@treazrisland.test",
      });
    });
    expect(
      screen.getByText(/If the account exists we sent reset instructions\./i),
    ).toBeInTheDocument();
  });

  it("validates password strength before confirming the reset", async () => {
    const setSession = vi.fn();
    useSessionMock.mockReturnValue(createSession({ setSession }));
    confirmPasswordResetActionMock.mockResolvedValue({
      success: true,
      payload: {
        user: { id: "1", email: "crew@treaz", nickname: "crew", role: "USER" },
        accessToken: "token",
        refreshExpiresAt: "future",
      },
    });

    render(<PasswordResetConfirmForm token="reset-token" />);

    fireEvent.change(screen.getByLabelText(/New password/i), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Choose a stronger password/i)).toBeInTheDocument();
    });
    expect(confirmPasswordResetActionMock).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("confirms the reset and updates the session", async () => {
    const setSession = vi.fn();
    useSessionMock.mockReturnValue(createSession({ setSession }));
    confirmPasswordResetActionMock.mockResolvedValue({
      success: true,
      payload: {
        user: { id: "1", email: "crew@treaz", nickname: "crew", role: "USER" },
        accessToken: "token",
        refreshExpiresAt: "future",
      },
    });

    render(<PasswordResetConfirmForm token="reset-token" />);

    fireEvent.change(screen.getByLabelText(/New password/i), {
      target: { value: "Stronger123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    await waitFor(() => {
      expect(confirmPasswordResetActionMock).toHaveBeenCalledWith({
        token: "reset-token",
        password: "Stronger123",
      });
    });
    expect(setSession).toHaveBeenCalledWith({
      user: { id: "1", email: "crew@treaz", nickname: "crew", role: "USER" },
      accessToken: "token",
      refreshExpiresAt: "future",
    });
    expect(pushMock).toHaveBeenCalledWith("/play");
    expect(refreshMock).toHaveBeenCalled();
  });
});
