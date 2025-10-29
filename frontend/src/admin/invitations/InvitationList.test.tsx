import React from "react";
import { render } from "@testing-library/react";
import { InvitationList } from "./InvitationList";

describe("InvitationList", () => {
  it("renders empty state", () => {
    const { getByText } = render(<InvitationList invitations={[]} />);
    expect(getByText(/No invitations issued yet/)).toBeInTheDocument();
  });

  it("renders invitation details", () => {
    const { getByText } = render(
      <InvitationList
        invitations={[
          {
            id: "invite_1",
            role: "USER",
            email: "guest@example.com",
            expiresAt: "2025-01-02T00:00:00.000Z",
            redeemedAt: null,
            createdAt: "2025-01-01T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(getByText(/USER/)).toBeInTheDocument();
    expect(getByText(/guest@example.com/)).toBeInTheDocument();
    expect(getByText(/Pending/)).toBeInTheDocument();
  });
});
