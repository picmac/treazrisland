import { apiFetch } from "./client";

export type CollectionRom = {
  id: string;
  title: string;
  position: number;
  note: string | null;
  platform: {
    id: string;
    name: string;
    slug: string;
    shortName: string | null;
  } | null;
};

export type RomCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  roms: CollectionRom[];
};

export async function listCollections(): Promise<{ collections: RomCollection[] }> {
  return apiFetch("/collections");
}

export async function getCollection(slug: string): Promise<{ collection: RomCollection }> {
  return apiFetch(`/collections/${encodeURIComponent(slug)}`);
}
