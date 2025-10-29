import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JoinForm } from "./JoinForm";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("@lib/api/netplay", () => ({
  joinNetplaySession: vi.fn()
}));

const joinNetplaySessionMock = vi.mocked(await import("@lib/api/netplay")).joinNetplaySession;

describe("JoinForm", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    joinNetplaySessionMock.mockReset();
  });

  it("submits join request", async () => {
    joinNetplaySessionMock.mockResolvedValueOnce({
      session: {
        id: "session_2",
        romId: null,
        joinCode: "WXYZ",
        status: "ACTIVE",
        isHost: false,
        canManage: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        participants: []
      },
      participant: {
        id: "participant_1",
        nickname: "Crewmate",
        userId: "user_1",
        isHost: false,
        status: "CONNECTED",
        joinedAt: new Date().toISOString()
      }
    });

    const { getByLabelText, getByText } = render(<JoinForm />);

    fireEvent.change(getByLabelText(/Join code/), { target: { value: "wxyz" } });
    fireEvent.change(getByLabelText(/Display name/), { target: { value: "Crewmate" } });

    fireEvent.click(getByText(/Join session/));

    await waitFor(() => {
      expect(joinNetplaySessionMock).toHaveBeenCalledWith({ joinCode: "WXYZ", nickname: "Crewmate" });
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
