"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/client";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  type FavoriteRom
} from "@lib/api/favorites";

export type FavoritesState = {
  favorites: FavoriteRom[];
  loading: boolean;
  error: string | null;
  isFavorite: (romId: string) => boolean;
  isPending: (romId: string) => boolean;
  toggleFavorite: (romId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useFavorites(): FavoritesState {
  const [favorites, setFavorites] = useState<FavoriteRom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listFavorites();
      setFavorites(response.favorites);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load favorites";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.romId)), [favorites]);

  const isFavorite = useCallback((romId: string) => favoriteIds.has(romId), [favoriteIds]);

  const isPending = useCallback((romId: string) => pending.has(romId), [pending]);

  const toggleFavorite = useCallback(
    async (romId: string) => {
      setPending((current) => {
        const next = new Set(current);
        next.add(romId);
        return next;
      });
      setError(null);

      try {
        if (isFavorite(romId)) {
          await removeFavorite(romId);
          setFavorites((current) => current.filter((favorite) => favorite.romId !== romId));
        } else {
          const created = await addFavorite(romId);
          setFavorites((current) => {
            if (current.some((favorite) => favorite.romId === romId)) {
              return current;
            }
            const next = [
              { romId, createdAt: created?.createdAt ?? new Date().toISOString() },
              ...current
            ];
            return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unable to update favorites";
        setError(message);
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(romId);
          return next;
        });
      }
    },
    [isFavorite]
  );

  return {
    favorites,
    loading,
    error,
    isFavorite,
    isPending,
    toggleFavorite,
    refresh
  };
}
