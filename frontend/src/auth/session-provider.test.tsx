import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload } from "@/src/lib/api/auth";
import { AuthProvider, useSession } from "@/src/auth/session-provider";

vi.mock("@/src/lib/api/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn()
}));

import { login, logout, refreshSession } from "@/src/lib/api/auth";

const loginMock = login as unknown as vi.Mock;
const logoutMock = logout as unknown as vi.Mock;
const refreshMock = refreshSession as unknown as vi.Mock;

function SessionProbe() {
  const session = useSession();
  return (
    <div>
      <span data-testid="token">{session.accessToken ?? "none"}</span>
      <span data-testid="loading">{session.loading ? "yes" : "no"}</span>
      <button onClick={() => session.login({ identifier: "captain", password: "Secret123" })}>login</button>
      <button onClick={() => session.logout()}>logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates session state from refresh endpoint", async () => {
    const payload: SessionPayload = {
      user: { id: "user-1", email: "user@example.com", nickname: "user", role: "USER" },
      accessToken: "token-123",
      refreshExpiresAt: new Date().toISOString()
    };
    refreshMock.mockResolvedValueOnce(payload);

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("yes");
    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("token-123"));
    expect(screen.getByTestId("loading").textContent).toBe("no");
  });

  it("clears session when refresh fails", async () => {
    refreshMock.mockRejectedValueOnce(new Error("nope"));

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("no"));
    expect(screen.getByTestId("token").textContent).toBe("none");
  });

  it("updates session on login and clears on logout", async () => {
    refreshMock.mockRejectedValueOnce(new Error("skip initial"));
    loginMock.mockResolvedValueOnce({
      user: { id: "user-2", email: "player@example.com", nickname: "player", role: "USER" },
      accessToken: "token-login",
      refreshExpiresAt: new Date().toISOString()
    });
    logoutMock.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("no"));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("token-login"));

    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"));
  });
});
