import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NetplayControls from "./NetplayControls";
import {
  listNetplaySessions,
  createNetplaySession,
  joinNetplaySession,
  sendNetplayHeartbeat,
  closeNetplaySession,
} from "@lib/api/netplay";
import { useNetplaySignal } from "@lib/api/netplay/useNetplaySignal";
import { useSession } from "@/src/auth/session-provider";

vi.mock("@lib/api/netplay", () => ({
  listNetplaySessions: vi.fn(),
  createNetplaySession: vi.fn(),
  joinNetplaySession: vi.fn(),
  sendNetplayHeartbeat: vi.fn(),
  closeNetplaySession: vi.fn(),
}));

vi.mock("@lib/api/netplay/useNetplaySignal", () => ({
  useNetplaySignal: vi.fn(),
}));

vi.mock("@/src/auth/session-provider", () => ({
  useSession: vi.fn(),
}));

describe("NetplayControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(useSession).mockReturnValue({
      user: { id: "user_1", email: "user@example.com", nickname: "host", role: "ADMIN" },
      accessToken: "token-1",
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      setSession: vi.fn(),
      clearSession: vi.fn(),
    });

    vi.mocked(useNetplaySignal).mockReturnValue({
      connected: false,
      latency: null,
      sendSignal: vi.fn(),
      close: vi.fn(),
    });

    vi.mocked(listNetplaySessions).mockResolvedValue({ sessions: [] });
    vi.mocked(createNetplaySession).mockResolvedValue({
      session: {
        id: "session_1",
        romId: "rom_1",
        hostId: "user_1",
        saveStateId: undefined,
        status: "OPEN",
        expiresAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participants: [
          {
            id: "participant_1",
            userId: "user_1",
            role: "HOST",
            status: "CONNECTED",
            lastHeartbeatAt: new Date().toISOString(),
            connectedAt: new Date().toISOString(),
            disconnectedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      peerToken: "peer-host",
    });
    vi.mocked(joinNetplaySession).mockResolvedValue({
      session: {
        id: "session_1",
        romId: "rom_1",
        hostId: "user_2",
        saveStateId: undefined,
        status: "ACTIVE",
        expiresAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participants: [
          {
            id: "participant_host",
            userId: "user_2",
            role: "HOST",
            status: "CONNECTED",
            lastHeartbeatAt: new Date().toISOString(),
            connectedAt: new Date().toISOString(),
            disconnectedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "participant_self",
            userId: "user_1",
            role: "PLAYER",
            status: "CONNECTED",
            lastHeartbeatAt: new Date().toISOString(),
            connectedAt: new Date().toISOString(),
            disconnectedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      peerToken: "peer-guest",
    });
    vi.mocked(sendNetplayHeartbeat).mockResolvedValue(undefined);
    vi.mocked(closeNetplaySession).mockResolvedValue(undefined);
  });

  it("renders and allows the host to create a session", async () => {
    render(<NetplayControls romId="rom_1" />);

    await waitFor(() => {
      expect(listNetplaySessions).toHaveBeenCalled();
    });

    const startButton = await screen.findByRole("button", { name: /start netplay session/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(createNetplaySession).toHaveBeenCalledWith({ romId: "rom_1" });
    });

    expect(await screen.findByText(/participants/i)).toBeInTheDocument();
    expect(sessionStorage.getItem("netplay:token:session_1")).toBe("peer-host");
  });

  it("surfaces a join action for invited participants", async () => {
    vi.mocked(listNetplaySessions).mockResolvedValue({
      sessions: [
        {
          id: "session_existing",
          romId: "rom_1",
          hostId: "user_2",
          saveStateId: undefined,
          status: "OPEN",
          expiresAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          participants: [
            {
              id: "participant_host",
              userId: "user_2",
              role: "HOST",
              status: "CONNECTED",
              lastHeartbeatAt: new Date().toISOString(),
              connectedAt: new Date().toISOString(),
              disconnectedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: "participant_self",
              userId: "user_1",
              role: "PLAYER",
              status: "INVITED",
              lastHeartbeatAt: null,
              connectedAt: null,
              disconnectedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    render(<NetplayControls romId="rom_1" />);

    await waitFor(() => {
      expect(listNetplaySessions).toHaveBeenCalled();
    });

    const joinButton = await screen.findByRole("button", { name: /join session/i });
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(joinNetplaySession).toHaveBeenCalledWith("session_existing");
    });
  });
});
