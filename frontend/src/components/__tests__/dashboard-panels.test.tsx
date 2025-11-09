import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@lib/api/player", () => ({
  listRecentPlayStates: vi.fn(),
}));

vi.mock("@lib/api/stats", () => ({
  getStatsOverview: vi.fn(),
}));

const { listRecentPlayStates } = await import("@lib/api/player");
const { getStatsOverview } = await import("@lib/api/stats");
const { DashboardPanels } = await import("../dashboard-panels");

describe("DashboardPanels", () => {
  beforeEach(() => {
    vi.mocked(listRecentPlayStates).mockReset();
    vi.mocked(getStatsOverview).mockReset();
  });

  it("renders stats and recent sessions", async () => {
    vi.mocked(getStatsOverview).mockResolvedValueOnce({
      user: {
        favorites: { count: 5 },
        playStates: { count: 3, totalBytes: 2048 },
        uploads: { count: 2 },
        topPlatforms: [],
      },
      server: {
        users: 4,
        roms: 120,
        playStates: 12,
        storageBytes: {
          romBinaries: 4096,
          assets: 1024,
          playStates: 512,
          total: 5632,
        },
      },
    });
    vi.mocked(listRecentPlayStates).mockResolvedValueOnce([
      {
        playState: {
          id: "state-1",
          romId: "rom-1",
          label: "Midnight save",
          slot: 2,
          size: 1024,
          checksumSha256: "hash",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloadUrl: "/play-states/state-1/binary",
        },
        rom: {
          id: "rom-1",
          title: "Chrono Trigger",
          platform: { id: "platform-1", name: "SNES", slug: "snes", shortName: "SNES" },
          assetSummary: { screenshots: [], videos: [], manuals: [] },
        },
      },
    ]);

    render(<DashboardPanels />);

    await waitFor(() => {
      expect(screen.getByText(/Server overview/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Crew members/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText(/Chrono Trigger/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 2/)).toBeInTheDocument();
  });

  it("surfaces an error when a panel fails to load", async () => {
    vi.mocked(getStatsOverview).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listRecentPlayStates).mockResolvedValueOnce([]);

    render(<DashboardPanels />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load all dashboard data/)).toBeInTheDocument();
    });
    expect(screen.getByText(/No cloud saves yet/)).toBeInTheDocument();
  });
});
