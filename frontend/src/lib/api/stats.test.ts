import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import { getStatsOverview, type StatsOverview } from "./stats";

describe("stats api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetches the stats overview", async () => {
    const overview = {
      user: {
        favorites: { count: 3 },
        playStates: { count: 2, totalBytes: 1024 },
        uploads: { count: 1 },
        topPlatforms: [],
      },
      server: {
        users: 5,
        roms: 200,
        playStates: 12,
        storageBytes: {
          romBinaries: 5120,
          assets: 2048,
          playStates: 1024,
          total: 8192,
        },
      },
    } satisfies StatsOverview;
    vi.mocked(apiFetch).mockResolvedValueOnce(overview);

    const result = await getStatsOverview();

    expect(apiFetch).toHaveBeenCalledWith("/stats/overview");
    expect(result).toBe(overview);
  });
});
