import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AdminInvitationForm } from "./AdminInvitationForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

vi.mock("@lib/api/invitations", () => ({
  createInvitation: vi.fn()
}));

const createInvitationMock = vi.mocked(await import("@lib/api/invitations")).createInvitation;

describe("AdminInvitationForm", () => {
  beforeEach(() => {
    createInvitationMock.mockReset();
  });

  it("submits invitation payload", async () => {
    createInvitationMock.mockResolvedValueOnce({
      invitation: {
        id: "invite_1",
        role: "USER",
        email: "guest@example.com",
        expiresAt: "2025-01-02T00:00:00.000Z",
        redeemedAt: null,
        createdAt: "2025-01-01T00:00:00.000Z"
      },
      token: "token"
    });

    const { getByLabelText, getByText } = render(<AdminInvitationForm />);

    fireEvent.change(getByLabelText(/Email/), { target: { value: "guest@example.com" } });
    fireEvent.change(getByLabelText(/Role/), { target: { value: "ADMIN" } });
    fireEvent.change(getByLabelText(/Expiry/), { target: { value: "48" } });

    fireEvent.click(getByText(/Create Invitation/));

    await waitFor(() => {
      expect(createInvitationMock).toHaveBeenCalledWith({
        email: "guest@example.com",
        role: "ADMIN",
        expiresInHours: 48
      });
    });
  });
});
