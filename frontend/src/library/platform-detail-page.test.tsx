import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@lib/api/client";

vi.mock("@lib/api/roms", () => ({
  getPlatform: vi.fn(),
  listRoms: vi.fn(),
  listPlatforms: vi.fn()
}));

vi.mock("@lib/api/favorites", () => ({
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn()
}));

const { getPlatform, listRoms, listPlatforms } = await import("@lib/api/roms");
const { listFavorites, addFavorite, removeFavorite } = await import("@lib/api/favorites");
const { PlatformDetailPage } = await import("./platform-detail-page");

describe("PlatformDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getPlatform).mockReset();
    vi.mocked(listRoms).mockReset();
    vi.mocked(listPlatforms).mockReset();
    vi.mocked(listFavorites).mockReset();
    vi.mocked(addFavorite).mockReset();
    vi.mocked(removeFavorite).mockReset();
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
    vi.mocked(listFavorites).mockResolvedValue({ favorites: [] });
    vi.mocked(addFavorite).mockResolvedValue({ romId: "rom_1", createdAt: new Date().toISOString() });
    vi.mocked(removeFavorite).mockResolvedValue();
  });

  it("fetches platform detail via slug endpoint", async () => {
    render(<PlatformDetailPage slug="snes" />);

    await waitFor(() => expect(getPlatform).toHaveBeenCalledWith("snes"));
    expect(listPlatforms).not.toHaveBeenCalled();
    await waitFor(() => expect(listRoms).toHaveBeenCalled());
    await waitFor(() => expect(listFavorites).toHaveBeenCalled());
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

  it("allows toggling a ROM favorite", async () => {
    render(<PlatformDetailPage slug="snes" />);

    await waitFor(() => expect(listRoms).toHaveBeenCalled());
    await waitFor(() => expect(listFavorites).toHaveBeenCalled());

    const favoriteButton = await screen.findByRole("button", { name: /add to favorites/i });
    fireEvent.click(favoriteButton);

    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith("rom_1"));

    expect(await screen.findByRole("button", { name: /remove from favorites/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("filters to favorites when requested", async () => {
    const createdAt = new Date().toISOString();
    vi.mocked(listFavorites).mockResolvedValueOnce({
      favorites: [{ romId: "rom_1", createdAt }]
    });

    render(<PlatformDetailPage slug="snes" />);

    await waitFor(() => expect(listFavorites).toHaveBeenCalled());
    const toggle = await screen.findByLabelText(/favorites only/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
    });
  });

  it("shows guidance when no favorites exist", async () => {
    vi.mocked(listFavorites).mockResolvedValueOnce({ favorites: [] });

    render(<PlatformDetailPage slug="snes" />);

    await waitFor(() => expect(listFavorites).toHaveBeenCalled());
    const toggle = await screen.findByLabelText(/favorites only/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/You have not marked any favorites/)).toBeInTheDocument();
    });
  });
});
