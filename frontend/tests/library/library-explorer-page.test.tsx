import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tanstack/react-virtual", () => {
  return {
    useVirtualizer: (options: { count: number }) => {
      const size = 260;
      return {
        getTotalSize: () => options.count * size,
        getVirtualItems: () =>
          Array.from({ length: options.count }, (_, index) => ({
            index,
            key: index,
            start: index * size,
            size
          })),
        measure: vi.fn()
      };
    }
  };
});

vi.mock("@lib/api/roms", () => ({
  usePlatformLibrary: vi.fn(),
  useRomLibrary: vi.fn()
}));

vi.mock("@/src/hooks/useFavorites", () => ({
  useFavorites: vi.fn()
}));

const { usePlatformLibrary, useRomLibrary } = await import("@lib/api/roms");
const { useFavorites } = await import("@/src/hooks/useFavorites");
const { LibraryExplorerPage } = await import("@/src/library/library-explorer-page");

describe("LibraryExplorerPage", () => {
  const toggleFavorite = vi.fn();

  beforeEach(() => {
    vi.mocked(usePlatformLibrary).mockReturnValue({
      data: {
        platforms: [
          {
            id: "platform_snes",
            name: "Super Nintendo",
            slug: "snes",
            shortName: "SNES",
            screenscraperId: 1,
            romCount: 2,
            heroArt: null,
            featuredRom: null
          }
        ]
      },
      error: null,
      isLoading: false,
      isValidating: false,
      refresh: vi.fn().mockResolvedValue(undefined),
      mutate: vi.fn(),
      key: "platforms:snes"
    });

    vi.mocked(useRomLibrary).mockReturnValue({
      data: {
        page: 1,
        pageSize: 24,
        total: 1,
        roms: [
          {
            id: "rom_chrono",
            title: "Chrono Trigger",
            platform: {
              id: "platform_snes",
              name: "Super Nintendo",
              slug: "snes",
              shortName: "SNES"
            },
            releaseYear: 1995,
            players: 1,
            romSize: 1024,
            screenscraperId: null,
            metadata: [
              {
                id: "meta_1",
                source: "MANUAL",
                language: "EN",
                region: null,
                summary: "Time travelling adventure.",
                storyline: null,
                developer: "Square",
                publisher: "Square",
                genre: "RPG",
                rating: null,
                createdAt: new Date().toISOString()
              }
            ],
            assetSummary: { screenshots: [], videos: [], manuals: [] },
            metadataHistory: []
          }
        ]
      },
      error: null,
      isLoading: false,
      isValidating: false,
      refresh: vi.fn().mockResolvedValue(undefined),
      mutate: vi.fn(),
      key: "roms:snes"
    });

    vi.mocked(useFavorites).mockReturnValue({
      favorites: [],
      loading: false,
      error: null,
      isFavorite: (romId: string) => romId === "rom_chrono",
      isPending: () => false,
      toggleFavorite,
      refresh: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders platforms and virtualized ROM entries", () => {
    render(<LibraryExplorerPage initialPlatformSlug="snes" />);

    expect(screen.getAllByText(/Super Nintendo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
    expect(screen.getByText(/Save-state sync coming soon/i)).toBeInTheDocument();
  });

  it("allows toggling favorites via pixel button", async () => {
    const user = userEvent.setup();
    render(<LibraryExplorerPage initialPlatformSlug="snes" />);

    const favoriteButton = screen.getByRole("button", { name: /Favorited/i });
    await user.click(favoriteButton);

    expect(toggleFavorite).toHaveBeenCalledWith("rom_chrono");
  });

  it("filters favorites via checkbox state", () => {
    render(<LibraryExplorerPage initialPlatformSlug="snes" />);

    const checkbox = screen.getByLabelText(/Favorites only/i);
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(useRomLibrary).toHaveBeenLastCalledWith(
      expect.objectContaining({ favoritesOnly: true })
    );
  });
});
