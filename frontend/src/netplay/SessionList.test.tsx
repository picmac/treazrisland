import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionList } from "./SessionList";
import type { NetplaySession } from "@lib/api/netplay";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("@lib/api/netplay", () => ({
  cancelNetplaySession: vi.fn()
}));

const cancelNetplaySessionMock = vi.mocked(await import("@lib/api/netplay")).cancelNetplaySession;

const baseSession: NetplaySession = {
  id: "session_1",
  romId: null,
  joinCode: "ABCD",
  status: "ACTIVE",
  isHost: true,
  canManage: true,
  createdAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  participants: [
    {
      id: "participant_1",
      nickname: "Host",
      userId: "user_1",
      isHost: true,
      status: "CONNECTED",
      joinedAt: new Date().toISOString()
    },
    {
      id: "participant_2",
      nickname: "Guest",
      userId: "user_2",
      isHost: false,
      status: "CONNECTED",
      joinedAt: new Date().toISOString()
    }
  ]
};

describe("SessionList", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    cancelNetplaySessionMock.mockReset();
  });

  it("shows empty state", () => {
    const { getByText } = render(<SessionList sessions={[]} />);

    expect(getByText(/No netplay sessions yet/)).toBeInTheDocument();
  });

  it("renders participants", () => {
    const { getByText, getAllByText } = render(<SessionList sessions={[baseSession]} />);

    expect(getByText(/Session ABCD/)).toBeInTheDocument();
    expect(getAllByText(/Host/).length).toBeGreaterThan(0);
    expect(getByText(/Guest/)).toBeInTheDocument();
  });

  it("cancels a session", async () => {
    cancelNetplaySessionMock.mockResolvedValueOnce({ success: true });

    const { getByText } = render(<SessionList sessions={[baseSession]} />);

    fireEvent.click(getByText(/Cancel session/));

    await waitFor(() => {
      expect(cancelNetplaySessionMock).toHaveBeenCalledWith("session_1");
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
