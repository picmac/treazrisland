import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, type MockedFunction } from "vitest";
import { ApiError } from "@/src/lib/api/client";
import { LoginForm } from "@/src/auth/login-form";

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

import { useSession, type AuthContextValue } from "@/src/auth/session-provider";
const useSessionMock = useSession as unknown as MockedFunction<typeof useSession>;

function createSessionStub(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    accessToken: null,
    loading: false,
    login: async () => ({ accessToken: "", refreshToken: "", user: null }),
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
    const loginMock = vi.fn().mockResolvedValue({});
    useSessionMock.mockReturnValue(createSessionStub({ login: loginMock }));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        identifier: "captain",
        password: "Secret123",
        mfaCode: undefined,
        recoveryCode: undefined
      });
    });

    expect(pushMock).toHaveBeenCalledWith("/play");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("prompts for MFA when the server demands it", async () => {
    const loginMock = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("MFA challenge required", 401, { mfaRequired: true }));
    useSessionMock.mockReturnValue(createSessionStub({ login: loginMock }));

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
    const loginMock = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("Invalid credentials", 401, { message: "Invalid credentials" }));
    useSessionMock.mockReturnValue(createSessionStub({ login: loginMock }));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/401: Invalid credentials/)).toBeInTheDocument();
    });
  });
});
