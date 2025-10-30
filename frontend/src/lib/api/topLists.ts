import { apiFetch } from "./client";

export type TopListEntry = {
  id: string;
  romId: string;
  title: string;
  rank: number;
  blurb: string | null;
  platform: {
    id: string;
    name: string;
    slug: string;
    shortName: string | null;
  } | null;
};

export type RomTopList = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  entries: TopListEntry[];
};

export async function listTopLists(): Promise<{ topLists: RomTopList[] }> {
  return apiFetch("/top-lists");
}

export async function getTopList(slug: string): Promise<{ topList: RomTopList }> {
  return apiFetch(`/top-lists/${encodeURIComponent(slug)}`);
}
