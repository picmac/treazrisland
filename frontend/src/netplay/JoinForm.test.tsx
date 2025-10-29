import React from "react";
import { act } from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
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
    joinNetplaySessionMock.mockReset();
    refreshMock.mockReset();
  });

  it("requires a join code", async () => {
    const { getByText } = render(<JoinForm />);

    await act(async () => {
      fireEvent.click(getByText(/Join session/));
    });

    expect(await screen.findByText(/Enter a join code/)).toBeInTheDocument();
    expect(joinNetplaySessionMock).not.toHaveBeenCalled();
  });

  it("submits the trimmed join code", async () => {
    joinNetplaySessionMock.mockResolvedValueOnce({
      session: {
        id: "session_3",
        code: "LMNO",
        hostId: "host_1",
        romId: null,
        status: "ACTIVE",
        expiresAt: "2025-01-01T01:00:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        participants: []
      },
      participant: {
        id: "participant_1",
        userId: "user_2",
        displayName: "Crewmate",
        nickname: "crew",
        role: "PLAYER",
        status: "READY",
        joinedAt: "2025-01-01T00:05:00.000Z",
        leftAt: null
      }
    });

    const onJoined = vi.fn();
    const { getByLabelText, getByText, findByText } = render(<JoinForm onJoined={onJoined} />);

    fireEvent.change(getByLabelText(/Join code/), { target: { value: " lmno " } });
    fireEvent.change(getByLabelText(/Display name/), { target: { value: "Crewmate" } });

    await act(async () => {
      fireEvent.click(getByText(/Join session/));
    });

    await waitFor(() => {
      expect(joinNetplaySessionMock).toHaveBeenCalledWith({
        code: "LMNO",
        displayName: "Crewmate"
      });
    });

    expect(await findByText(/Joined session LMNO/)).toBeInTheDocument();
    expect(onJoined).toHaveBeenCalledWith(expect.objectContaining({ id: "session_3" }));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows loading state while joining", async () => {
    let resolveJoin: ((value: unknown) => void) | null = null;
    joinNetplaySessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJoin = resolve;
        })
    );

    render(<JoinForm />);

    fireEvent.change(screen.getByLabelText(/Join code/), { target: { value: "ABCD" } });
    await act(async () => {
      fireEvent.click(screen.getByText(/Join session/));
    });

    await waitFor(() => {
      expect(screen.getByText(/Connecting/)).toBeInTheDocument();
    });

    resolveJoin?.({
      session: {
        id: "session_4",
        code: "ABCD",
        hostId: "host_1",
        romId: null,
        status: "ACTIVE",
        expiresAt: "2025-01-01T01:00:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        participants: []
      },
      participant: {
        id: "participant_2",
        userId: "user_3",
        displayName: null,
        nickname: "pirate",
        role: "PLAYER",
        status: "READY",
        joinedAt: "2025-01-01T00:05:00.000Z",
        leftAt: null
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/Joined session ABCD/)).toBeInTheDocument();
    });
  });
});
