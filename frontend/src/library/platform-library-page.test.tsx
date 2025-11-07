import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@lib/api/library", () => ({
  listPlatforms: vi.fn()
}));

const { listPlatforms } = await import("@lib/api/library");
const { PlatformLibraryPage } = await import("./platform-library-page");

describe("PlatformLibraryPage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MEDIA_CDN = "https://cdn.test";
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
          heroArt: null,
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
          heroArt: null,
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

  it("prioritises curated hero art when present", async () => {
    const now = new Date().toISOString();
    vi.mocked(listPlatforms).mockResolvedValueOnce({
      platforms: [
        {
          id: "platform_snes",
          name: "Super Nintendo",
          slug: "snes",
          shortName: "SNES",
          screenscraperId: 1,
          romCount: 1,
          heroArt: {
            assetId: "asset_1",
            slug: "snes-hero",
            kind: "HERO",
            status: "ACTIVE",
            storageKey: "creative-assets/snes/hero.png",
            mimeType: "image/png",
            width: 800,
            height: 450,
            fileSize: 2048,
            checksumSha256: "abcdef",
            signedUrl: null,
            signedUrlExpiresAt: null,
            updatedAt: now,
            notes: "Curated cover"
          },
          featuredRom: {
            id: "rom_1",
            title: "Chrono Trigger",
            updatedAt: now,
            assetSummary: { screenshots: [], videos: [], manuals: [] }
          }
        }
      ]
    });

    render(<PlatformLibraryPage />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    expect(screen.getByText(/Curated hero art/i)).toBeInTheDocument();
    expect(
      screen.getByAltText(/Super Nintendo curated hero art/i)
    ).toBeInTheDocument();
  });
});
