'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  FALLBACK_ASSETS,
  FALLBACK_PIXELLAB_THEME,
  type PixellabAsset,
  type PixellabThemeManifest,
  type PixellabThemeTokens,
  mergeThemeTokens
} from './pixellabTheme';

type ThemeProviderProps = {
  children: ReactNode;
  manifestPath?: string;
};

type PixellabThemeContextValue = {
  tokens: PixellabThemeTokens;
  assets: PixellabAsset[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  refresh: () => void;
};

const PixellabThemeContext = createContext<PixellabThemeContextValue>({
  tokens: FALLBACK_PIXELLAB_THEME,
  assets: FALLBACK_ASSETS,
  status: 'idle',
  refresh: () => {}
});

export function ThemeProvider({ children, manifestPath = '/themes/pixellab/manifest.json' }: ThemeProviderProps) {
  const [tokens, setTokens] = useState<PixellabThemeTokens>(FALLBACK_PIXELLAB_THEME);
  const [assets, setAssets] = useState<PixellabAsset[]>(FALLBACK_ASSETS);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => {
    setRefreshIndex((value) => value + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadManifest() {
      setStatus('loading');
      setError(undefined);
      try {
        const response = await fetch(manifestPath, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Manifest request failed (${response.status})`);
        }

        const manifest = (await response.json()) as PixellabThemeManifest;
        if (!isMounted) {
          return;
        }

        const mergedTokens = mergeThemeTokens(FALLBACK_PIXELLAB_THEME, manifest.tokens);
        setTokens(mergedTokens);
        setAssets(manifest.assets?.length ? manifest.assets : FALLBACK_ASSETS);
        setStatus('ready');
      } catch (manifestError) {
        if (!isMounted) {
          return;
        }

        setTokens(FALLBACK_PIXELLAB_THEME);
        setAssets(FALLBACK_ASSETS);
        setError(manifestError instanceof Error ? manifestError.message : 'Unknown manifest error');
        setStatus('error');
      }
    }

    loadManifest();

    return () => {
      isMounted = false;
    };
  }, [manifestPath, refreshIndex]);

  const value = useMemo<PixellabThemeContextValue>(
    () => ({
      tokens,
      assets,
      status,
      error,
      refresh
    }),
    [tokens, assets, status, error, refresh]
  );

  return <PixellabThemeContext.Provider value={value}>{children}</PixellabThemeContext.Provider>;
}

export function usePixellabTheme() {
  return useContext(PixellabThemeContext);
}
