import React from "react";
import { act } from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { HostForm } from "./HostForm";
import type { NetplaySession } from "@lib/api/netplay";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("@lib/api/netplay", () => ({
  createNetplaySession: vi.fn()
}));

const createNetplaySessionMock = vi.mocked(await import("@lib/api/netplay")).createNetplaySession;

describe("HostForm", () => {
  beforeEach(() => {
    createNetplaySessionMock.mockReset();
    refreshMock.mockReset();
  });

  it("validates session length before submitting", async () => {
    const { getByLabelText, getByText, findByText } = render(<HostForm />);

    fireEvent.change(getByLabelText(/Session length/), { target: { value: "3" } });
    await act(async () => {
      fireEvent.click(getByText(/Host session/));
    });

    expect(await findByText(/between 5 and 360 minutes/)).toBeInTheDocument();
    expect(createNetplaySessionMock).not.toHaveBeenCalled();
  });

  it("submits payload and shows success message", async () => {
    createNetplaySessionMock.mockResolvedValueOnce({
      session: {
        id: "session_1",
        code: "abcd",
        hostId: "user_1",
        romId: "rom_123",
        status: "ACTIVE",
        expiresAt: "2025-01-01T00:30:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        participants: []
      }
    });

    const onHosted = vi.fn();
    const { getByLabelText, getByText, findByText } = render(<HostForm onHosted={onHosted} />);

    fireEvent.change(getByLabelText(/ROM ID/), { target: { value: " rom_123 " } });
    fireEvent.change(getByLabelText(/Display name/), { target: { value: "Captain" } });
    fireEvent.change(getByLabelText(/Session length/), { target: { value: "45" } });

    await act(async () => {
      fireEvent.click(getByText(/Host session/));
    });

    await waitFor(() => {
      expect(createNetplaySessionMock).toHaveBeenCalledWith({
        romId: "rom_123",
        displayName: "Captain",
        expiresInMinutes: 45
      });
    });

    expect(await findByText(/Share code ABCD/)).toBeInTheDocument();
    expect(onHosted).toHaveBeenCalledWith(expect.objectContaining({ id: "session_1" }));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows optimistic pending state", async () => {
    let resolveRequest: ((value: { session: NetplaySession }) => void) | null = null;

    createNetplaySessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<HostForm />);

    fireEvent.change(screen.getByLabelText(/Session length/), { target: { value: "30" } });
    await act(async () => {
      fireEvent.click(screen.getByText(/Host session/));
    });

    await waitFor(() => {
      expect(screen.getByText(/Creating session/)).toBeInTheDocument();
    });

    resolveRequest?.({
      session: {
        id: "session_2",
        code: "zyxw",
        hostId: "user_1",
        romId: null,
        status: "ACTIVE",
        expiresAt: "2025-01-01T01:00:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        participants: []
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/Share code ZYXW/)).toBeInTheDocument();
    });
  });
});
