import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/api/library", () => ({
  listRoms: vi.fn()
}));

vi.mock("@lib/api/favorites", () => ({
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn()
}));

const { listRoms } = await import("@lib/api/library");
const { listFavorites, addFavorite, removeFavorite } = await import("@lib/api/favorites");
const { FavoritesPage } = await import("./favorites-page");

const baseRom = {
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
};

describe("FavoritesPage", () => {
  beforeEach(() => {
    vi.mocked(listRoms).mockReset();
    vi.mocked(listFavorites).mockReset();
    vi.mocked(addFavorite).mockReset();
    vi.mocked(removeFavorite).mockReset();

    vi.mocked(listRoms).mockResolvedValue({
      page: 1,
      pageSize: 60,
      total: 1,
      roms: [baseRom]
    });

    vi.mocked(listFavorites).mockResolvedValue({
      favorites: [{ romId: baseRom.id, createdAt: new Date().toISOString() }]
    });

    vi.mocked(addFavorite).mockResolvedValue({ romId: baseRom.id, createdAt: new Date().toISOString() });
    vi.mocked(removeFavorite).mockResolvedValue();
  });

  it("renders the starred library", async () => {
    render(<FavoritesPage />);

    await waitFor(() => expect(listRoms).toHaveBeenCalled());
    await waitFor(() => expect(listFavorites).toHaveBeenCalled());

    expect(screen.getByRole("heading", { name: /Starred Adventures/i })).toBeInTheDocument();
    expect(await screen.findByText(/Chrono Trigger/)).toBeInTheDocument();

    expect(vi.mocked(listRoms).mock.calls[0][0]).toMatchObject({ favoritesOnly: true });
  });

  it("removes a ROM from favorites", async () => {
    render(<FavoritesPage />);

    const removeButton = await screen.findByRole("button", { name: /remove from favorites/i });
    fireEvent.click(removeButton);

    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith(baseRom.id));
    await waitFor(() => {
      expect(screen.queryByText(/Chrono Trigger/)).not.toBeInTheDocument();
    });
  });

  it("shows guidance when no favorites exist", async () => {
    vi.mocked(listFavorites).mockResolvedValueOnce({ favorites: [] });
    vi.mocked(listRoms).mockResolvedValueOnce({ page: 1, pageSize: 60, total: 0, roms: [] });

    render(<FavoritesPage />);

    await waitFor(() => expect(listFavorites).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/You have not starred any adventures yet/i)).toBeInTheDocument();
    });
  });

  it("filters favorites by platform chip", async () => {
    const secondRom = {
      ...baseRom,
      id: "rom_2",
      title: "Monkey Island",
      platform: {
        id: "platform_pc",
        name: "PC",
        slug: "pc",
        shortName: "PC"
      }
    };

    vi.mocked(listRoms).mockResolvedValueOnce({
      page: 1,
      pageSize: 60,
      total: 2,
      roms: [baseRom, secondRom]
    });

    vi.mocked(listFavorites).mockResolvedValueOnce({
      favorites: [
        { romId: baseRom.id, createdAt: new Date().toISOString() },
        { romId: secondRom.id, createdAt: new Date().toISOString() }
      ]
    });

    render(<FavoritesPage />);

    await waitFor(() => screen.getByRole("button", { name: /SNES/i }));
    const snesChip = screen.getByRole("button", { name: /SNES/i });
    fireEvent.click(snesChip);

    await waitFor(() => {
      expect(vi.mocked(listRoms).mock.calls.at(-1)?.[0]).toMatchObject({ platform: "snes" });
    });

    await waitFor(() => {
      expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
      expect(screen.queryByText(/Monkey Island/)).not.toBeInTheDocument();
    });
  });
});
