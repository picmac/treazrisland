import { render, screen, within } from "@testing-library/react";
import React from "react";

import { AdminPlatformDirectory } from "../AdminPlatformDirectory";

const mockPlatforms = [
  {
    id: "platform-1",
    name: "Super Nintendo Entertainment System",
    slug: "snes",
    shortName: "SNES",
  },
  {
    id: "platform-2",
    name: "Sega Genesis",
    slug: "genesis",
    shortName: null,
  },
];

describe("AdminPlatformDirectory", () => {
  it("renders a card for each platform", () => {
    render(<AdminPlatformDirectory platforms={mockPlatforms} />);

    const snesCard = screen.getByText(/Super Nintendo Entertainment System/i).closest("li");
    expect(snesCard).not.toBeNull();
    expect(within(snesCard as HTMLElement).getByText("snes")).toBeInTheDocument();
    expect(within(snesCard as HTMLElement).getByText("platform-1")).toBeInTheDocument();

    const genesisCard = screen.getByText(/Sega Genesis/i).closest("li");
    expect(genesisCard).not.toBeNull();
    expect(within(genesisCard as HTMLElement).getByText("genesis")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /Open library view/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/platforms/snes");
    expect(links[1]).toHaveAttribute("href", "/platforms/genesis");
  });

  it("shows an empty state when no platforms exist", () => {
    render(<AdminPlatformDirectory platforms={[]} />);

    expect(
      screen.getByText(/No platforms are registered yet. Seed the catalog with the CLI or onboarding wizard/i),
    ).toBeInTheDocument();
  });
});
