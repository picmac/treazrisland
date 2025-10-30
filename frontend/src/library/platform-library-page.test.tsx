import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@lib/api/library", () => ({
  listPlatforms: vi.fn()
}));

const { listPlatforms } = await import("@lib/api/library");
const { PlatformLibraryPage } = await import("./platform-library-page");

describe("PlatformLibraryPage", () => {
  beforeEach(() => {
    vi.mocked(listPlatforms).mockReset();
    vi.mocked(listPlatforms).mockResolvedValue({
      platforms: [
        {
          id: "platform_snes",
          name: "Super Nintendo",
          slug: "snes",
          shortName: "SNES",
          screenscraperId: 1,
          romCount: 2,
          featuredRom: {
            id: "rom_1",
            title: "Chrono Trigger",
            updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
            assetSummary: { screenshots: [], videos: [], manuals: [] }
          }
        },
        {
          id: "platform_mega",
          name: "Mega Drive",
          slug: "genesis",
          shortName: "MD",
          screenscraperId: 2,
          romCount: 1,
          featuredRom: {
            id: "rom_2",
            title: "Sonic",
            updatedAt: new Date("2023-12-01T00:00:00Z").toISOString(),
            assetSummary: { screenshots: [], videos: [], manuals: [] }
          }
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces an empty state when client filters remove all platforms", async () => {
    render(<PlatformLibraryPage />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    expect(screen.getByText(/Super Nintendo/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search ROMs or summaries"), {
      target: { value: "nonexistent" }
    });

    await waitFor(() => {
      expect(screen.getByText(/No platforms match those filters yet/)).toBeInTheDocument();
    });
  });

  it("sorts platforms based on the chosen direction", async () => {
    render(<PlatformLibraryPage />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    const directionSelect = screen.getByLabelText("Direction");
    fireEvent.change(directionSelect, { target: { value: "desc" } });

    const cards = screen.getAllByRole("link", { name: /ROMs/ });
    expect(cards[0]).toHaveTextContent(/Super Nintendo/);
  });
});
