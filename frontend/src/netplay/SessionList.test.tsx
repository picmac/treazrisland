import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionList } from "./SessionList";
import type { NetplaySession } from "@lib/api/netplay";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("@lib/api/netplay", () => ({
  endNetplaySession: vi.fn()
}));

const endNetplaySessionMock = vi.mocked(await import("@lib/api/netplay")).endNetplaySession;

const baseSession: NetplaySession = {
  id: "session_1",
  code: "ABCD",
  hostId: "host_1",
  romId: null,
  status: "ACTIVE",
  expiresAt: "2025-01-01T01:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
  participants: [
    {
      id: "participant_1",
      userId: "user_1",
      displayName: "Hosty",
      nickname: "host",
      role: "HOST",
      status: "READY",
      joinedAt: "2025-01-01T00:00:00.000Z",
      leftAt: null
    },
    {
      id: "participant_2",
      userId: "user_2",
      displayName: null,
      nickname: "deckhand",
      role: "PLAYER",
      status: "WAITING",
      joinedAt: "2025-01-01T00:05:00.000Z",
      leftAt: null
    }
  ],
  isHost: true
};

describe("SessionList", () => {
  beforeEach(() => {
    endNetplaySessionMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders empty state when no sessions", () => {
    render(<SessionList initialSessions={[]} />);
    expect(screen.getByText(/No active sessions yet/)).toBeInTheDocument();
  });

  it("shows participants with status badges", () => {
    render(<SessionList initialSessions={[baseSession]} />);

    expect(screen.getByText(/Hosty/)).toBeInTheDocument();
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
    expect(screen.getByText(/deckhand/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting/)).toBeInTheDocument();
  });

  it("ends a session optimistically", async () => {
    endNetplaySessionMock.mockResolvedValueOnce({ session: baseSession });

    render(<SessionList initialSessions={[baseSession]} />);

    fireEvent.click(screen.getByText(/End session/));

    await waitFor(() => {
      expect(endNetplaySessionMock).toHaveBeenCalledWith("session_1");
    });

    await waitFor(() => {
      expect(screen.queryByText(/ABCD/)).not.toBeInTheDocument();
    });

    expect(refreshMock).toHaveBeenCalled();
  });
});
