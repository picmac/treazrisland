import { apiFetch } from "./client";

export type FavoriteRom = {
  romId: string;
  createdAt: string;
};

export async function listFavorites(): Promise<{ favorites: FavoriteRom[] }> {
  return apiFetch("/favorites");
}

export async function addFavorite(romId: string): Promise<FavoriteRom | null> {
  const response = await apiFetch<{ favorite: FavoriteRom } | undefined>(
    `/favorites/${encodeURIComponent(romId)}`,
    {
      method: "POST"
    }
  );

  if (!response) {
    return null;
  }

  return response.favorite;
}

export async function removeFavorite(romId: string): Promise<void> {
  await apiFetch(`/favorites/${encodeURIComponent(romId)}`, {
    method: "DELETE"
  });
}
