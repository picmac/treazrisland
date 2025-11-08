import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, type MockedFunction } from "vitest";
import { LoginForm } from "@/src/auth/login-form";

vi.mock("@/app/(auth)/login/actions", () => ({
  performLogin: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

vi.mock("@/src/auth/session-provider", () => ({
  useSession: vi.fn()
}));

import { performLogin } from "@/app/(auth)/login/actions";
import { useSession, type AuthContextValue } from "@/src/auth/session-provider";
const useSessionMock = useSession as unknown as MockedFunction<typeof useSession>;
const performLoginMock = performLogin as unknown as MockedFunction<typeof performLogin>;

function createSessionStub(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    accessToken: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    ...overrides
  };
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits credentials and redirects on success", async () => {
    const setSession = vi.fn();
    useSessionMock.mockReturnValue(createSessionStub({ setSession }));
    performLoginMock.mockResolvedValue({
      success: true,
      payload: {
        accessToken: "token",
        refreshExpiresAt: "future",
        user: { id: "1", email: "captain@treaz", nickname: "captain", role: "PLAYER" }
      }
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(performLoginMock).toHaveBeenCalledWith({
        identifier: "captain",
        password: "Secret123",
        mfaCode: undefined,
        recoveryCode: undefined
      });
    });

    expect(setSession).toHaveBeenCalledWith({
      accessToken: "token",
      refreshExpiresAt: "future",
      user: { id: "1", email: "captain@treaz", nickname: "captain", role: "PLAYER" }
    });
    expect(pushMock).toHaveBeenCalledWith("/play");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("prompts for MFA when the server demands it", async () => {
    useSessionMock.mockReturnValue(createSessionStub({}));
    performLoginMock.mockResolvedValueOnce({
      success: false,
      error: "Enter your MFA code or recovery code to continue.",
      mfaRequired: true
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByLabelText(/MFA Code/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Enter your MFA code or recovery code/i)).toBeInTheDocument();
  });

  it("shows error messages for unexpected failures", async () => {
    useSessionMock.mockReturnValue(createSessionStub({}));
    performLoginMock.mockResolvedValueOnce({
      success: false,
      error: "Invalid credentials"
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    });
  });
});
