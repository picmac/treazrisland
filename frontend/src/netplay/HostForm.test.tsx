import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HostForm } from "./HostForm";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("@lib/api/netplay", () => ({
  hostNetplaySession: vi.fn()
}));

const hostNetplaySessionMock = vi.mocked(await import("@lib/api/netplay")).hostNetplaySession;

describe("HostForm", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    hostNetplaySessionMock.mockReset();
  });

  it("submits payload and refreshes router", async () => {
    hostNetplaySessionMock.mockResolvedValueOnce({
      session: {
        id: "session_1",
        romId: "rom_1",
        joinCode: "ABCD",
        status: "ACTIVE",
        isHost: true,
        canManage: true,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        participants: []
      }
    });

    const { getByLabelText, getByText } = render(<HostForm />);

    fireEvent.change(getByLabelText(/ROM ID/), { target: { value: "rom_1" } });
    fireEvent.change(getByLabelText(/Session length/), { target: { value: "90" } });

    fireEvent.click(getByText(/Create session/));

    await waitFor(() => {
      expect(hostNetplaySessionMock).toHaveBeenCalledWith({ romId: "rom_1", ttlMinutes: 90 });
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
