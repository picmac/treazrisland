'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/apiClient';
import { fetchLatestSaveState, type LatestSaveStateResponse } from '@/lib/saveStates';

export function useSaveStates(romId?: string) {
  const [latestSaveState, setLatestSaveState] = useState<LatestSaveStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadLatestSaveState = useCallback(async (): Promise<LatestSaveStateResponse | null> => {
    if (!romId) {
      setLatestSaveState(null);
      return null;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetchLatestSaveState(romId);
      setLatestSaveState(response);
      return response;
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        setLatestSaveState(null);
        return null;
      }

      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load the latest save state';
      setError(message);
      throw loadError instanceof Error ? loadError : new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [romId]);

  useEffect(() => {
    loadLatestSaveState().catch(() => {
      // Errors here are surfaced through the error state, so we swallow them silently
      // to avoid unhandled promise rejections when the hook auto-loads.
    });
  }, [loadLatestSaveState]);

  return {
    latestSaveState,
    isLoading,
    error,
    loadLatestSaveState,
  };
}
