import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@lib/api/client";

vi.mock("@lib/api/library", () => ({
  getPlatform: vi.fn(),
  listRoms: vi.fn(),
  listPlatforms: vi.fn()
}));

const { getPlatform, listRoms, listPlatforms } = await import("@lib/api/library");
const { PlatformDetailPage } = await import("./platform-detail-page");

describe("PlatformDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getPlatform).mockReset();
    vi.mocked(listRoms).mockReset();
    vi.mocked(listPlatforms).mockReset();
    vi.mocked(getPlatform).mockResolvedValue({
      platform: {
        id: "platform_snes",
        name: "Super Nintendo",
        slug: "snes",
        shortName: "SNES",
        screenscraperId: 1,
        romCount: 2,
        featuredRom: null
      }
    });
    vi.mocked(listRoms).mockResolvedValue({
      page: 1,
      pageSize: 60,
      total: 2,
      roms: [
        {
          id: "rom_1",
          title: "Chrono Trigger",
          platform: {
            id: "platform_snes",
            name: "Super Nintendo",
            slug: "snes",
            shortName: "SNES"
          },
          releaseYear: 1995,
          players: 1,
          romSize: 8388608,
          screenscraperId: 1234,
          metadata: {
            id: "meta_1",
            source: "SCREEN_SCRAPER",
            language: "en",
            region: "us",
            summary: "Epic time adventure",
            storyline: null,
            developer: "Square",
            publisher: "Square",
            genre: "RPG",
            rating: 4.9,
            createdAt: new Date().toISOString()
          },
          assetSummary: { cover: undefined, screenshots: [], videos: [], manuals: [] }
        }
      ]
    });
  });

  it("fetches platform detail via slug endpoint", async () => {
    render(<PlatformDetailPage slug="snes" />);

    await waitFor(() => expect(getPlatform).toHaveBeenCalledWith("snes"));
    expect(listPlatforms).not.toHaveBeenCalled();
    await waitFor(() => expect(listRoms).toHaveBeenCalled());
    expect(screen.getByText(/Super Nintendo/)).toBeInTheDocument();
    expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
  });

  it("surfaces platform lookup failures", async () => {
    vi.mocked(getPlatform).mockRejectedValueOnce(new ApiError("Not found", 404));

    render(<PlatformDetailPage slug="unknown" />);

    await waitFor(() => expect(getPlatform).toHaveBeenCalledWith("unknown"));
    await waitFor(() => {
      expect(screen.getByText(/Platform not found/)).toBeInTheDocument();
    });
  });
});
