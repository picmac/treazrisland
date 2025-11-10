import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@lib/api/roms", () => ({
  useRomDetail: vi.fn()
}));

vi.mock("@/src/hooks/useFavorites", () => ({
  useFavorites: vi.fn()
}));

vi.mock("@lib/api/player", async () => {
  const actual = await vi.importActual<typeof import("@lib/api/player")>(
    "@lib/api/player"
  );
  return {
    ...actual,
    useRomPlayStates: vi.fn()
  };
});

const { useRomDetail } = await import("@lib/api/roms");
const { useFavorites } = await import("@/src/hooks/useFavorites");
const { useRomPlayStates } = await import("@lib/api/player");
const { LibraryRomDetailShell } = await import("@/src/library/library-rom-detail-shell");

describe("LibraryRomDetailShell", () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const toggleFavorite = vi.fn();

  beforeEach(() => {
    vi.mocked(useRomDetail).mockReturnValue({
      data: {
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
        romSize: 2048,
        romHash: null,
        screenscraperId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: [
          {
            id: "meta_1",
            source: "MANUAL",
            language: "EN",
            region: null,
            summary: "Guard the flow of time.",
            storyline: null,
            developer: "Square",
            publisher: "Square",
            genre: "RPG",
            rating: null,
            createdAt: new Date().toISOString()
          }
        ],
        assets: [
          {
            id: "asset_1",
            type: "COVER",
            source: "CURATED",
            providerId: null,
            language: null,
            region: null,
            width: null,
            height: null,
            fileSize: null,
            format: null,
            checksum: null,
            storageKey: null,
            externalUrl: null,
            createdAt: new Date().toISOString()
          }
        ],
        binary: {
          id: "binary_1",
          storageKey: "roms/chrono.sfc",
          originalFilename: "chrono.sfc",
          archiveMimeType: "application/octet-stream",
          archiveSize: 2048,
          checksumSha256: "abc",
          checksumSha1: null,
          checksumMd5: null,
          checksumCrc32: null,
          status: "AVAILABLE",
          uploadedAt: new Date().toISOString()
        },
        enrichmentJobs: [],
        uploadAudits: []
      },
      error: null,
      isLoading: false,
      isValidating: false,
      refresh,
      mutate: vi.fn(),
      key: "rom:rom_chrono"
    });

    vi.mocked(useFavorites).mockReturnValue({
      favorites: [],
      loading: false,
      error: null,
      isFavorite: () => false,
      isPending: () => false,
      toggleFavorite,
      refresh: vi.fn()
    });

    const playState = {
      id: "state_1",
      romId: "rom_chrono",
      label: "End of Time",
      slot: 1,
      size: 4096,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state_1/binary"
    };

    vi.mocked(useRomPlayStates).mockReturnValue({
      data: [playState],
      error: null,
      isLoading: false,
      isValidating: false,
      refresh: vi.fn(),
      mutate: vi.fn(),
      key: "rom-play-states:rom_chrono"
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders metadata and populated cloud saves", () => {
    render(<LibraryRomDetailShell romId="rom_chrono" />);

    expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
    expect(screen.getByText(/Guard the flow of time/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Resume Chrono Trigger from End of Time/i
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Launch Emulator/i })).toHaveAttribute(
      "href",
      "/play/rom_chrono"
    );
  });

  it("allows refreshing and toggling favorites", async () => {
    const user = userEvent.setup();
    render(<LibraryRomDetailShell romId="rom_chrono" />);

    const refreshButton = screen.getByRole("button", { name: /Refresh details/i });
    await user.click(refreshButton);
    expect(refresh).toHaveBeenCalled();

    const favoriteButton = screen.getByRole("button", { name: /Favorite/i });
    await user.click(favoriteButton);
    expect(toggleFavorite).toHaveBeenCalledWith("rom_chrono");
  });

  it("shows empty state messaging when no cloud saves are present", () => {
    vi.mocked(useRomPlayStates).mockReturnValueOnce({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      refresh: vi.fn(),
      mutate: vi.fn(),
      key: "rom-play-states:rom_chrono"
    });

    render(<LibraryRomDetailShell romId="rom_chrono" />);

    expect(screen.getByText(/No cloud saves yet/i)).toBeInTheDocument();
  });

  it("surfaces error state when cloud save loading fails", () => {
    vi.mocked(useRomPlayStates).mockReturnValueOnce({
      data: null,
      error: new Error("kaboom"),
      isLoading: false,
      isValidating: false,
      refresh: vi.fn(),
      mutate: vi.fn(),
      key: "rom-play-states:rom_chrono"
    });

    render(<LibraryRomDetailShell romId="rom_chrono" />);

    expect(screen.getByText(/Failed to load save slots/i)).toBeInTheDocument();
  });
});
