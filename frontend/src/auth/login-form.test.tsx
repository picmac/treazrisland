import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

import { useSession } from "@/src/auth/session-provider";
const useSessionMock = useSession as unknown as vi.Mock;

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits credentials and redirects on success", async () => {
    const loginMock = vi.fn().mockResolvedValue({});
    useSessionMock.mockReturnValue({ login: loginMock } as any);

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
    useSessionMock.mockReturnValue({ login: loginMock } as any);

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
    useSessionMock.mockReturnValue({ login: loginMock } as any);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email or Nickname/i), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/401: Invalid credentials/)).toBeInTheDocument();
    });
  });
});
