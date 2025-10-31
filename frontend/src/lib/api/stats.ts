import { apiFetch } from "./client";

export type StatsOverview = {
  user: {
    favorites: { count: number };
    playStates: { count: number; totalBytes: number };
    uploads: { count: number };
    topPlatforms: Array<{
      id: string;
      name: string;
      slug: string;
      shortName: string | null;
      playStateCount: number;
    }>;
  };
  server: {
    users: number;
    roms: number;
    playStates: number;
    storageBytes: {
      romBinaries: number;
      assets: number;
      playStates: number;
      total: number;
    };
  };
};

export async function getStatsOverview(): Promise<StatsOverview> {
  return apiFetch<StatsOverview>("/stats/overview");
}
