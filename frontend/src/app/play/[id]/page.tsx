'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ControlOverlay } from '@/components/emulator/ControlOverlay';
import { SessionPrepDialog } from '@/components/emulator/SessionPrepDialog';
import { fetchRomDetails } from '@/lib/roms';
import type { RomAsset, RomDetails } from '@/types/rom';

type PlayPageProps = {
  params: { id: string };
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type EmulatorWindow = Window & {
  EJS_player?: string;
  EJS_core?: string;
  EJS_gameUrl?: string;
  EJS_biosUrl?: string;
  EJS_color?: string;
  EJS_onGameStart?: () => void;
};

const CORE_BY_PLATFORM: Record<string, string> = {
  nes: 'nes',
  snes: 'snes',
  genesis: 'segaMD',
  megadrive: 'segaMD',
  gba: 'gba',
  gb: 'gb',
  gbc: 'gbc',
  n64: 'n64'
};

export default function PlayPage({ params }: PlayPageProps) {
  const romId = params.id;
  const [rom, setRom] = useState<RomDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string>();
  const [showPrepDialog, setShowPrepDialog] = useState(true);
  const [isSessionReady, setSessionReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadState('loading');
    setError(undefined);
    setRom(null);

    fetchRomDetails(romId)
      .then((response) => {
        if (!isMounted) {
          return;
        }
        if (!response) {
          setLoadState('error');
          setError('ROM dossier unavailable.');
          return;
        }
        setRom(response);
        setLoadState('ready');
      })
      .catch((romError) => {
        if (!isMounted) {
          return;
        }
        setLoadState('error');
        setError(romError instanceof Error ? romError.message : 'Unable to load ROM metadata.');
      });

    return () => {
      isMounted = false;
    };
  }, [romId]);

  useEffect(() => {
    setSessionReady(false);
    setShowPrepDialog(true);
  }, [romId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storageKey = getSaveKey(romId);
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as { savedAt: string };
        setLastSavedAt(new Date(parsed.savedAt));
      } catch (storageError) {
        console.warn('Failed to parse saved state timestamp', storageError);
      }
    }
  }, [romId]);

  const romAsset = useMemo(() => selectRomBinary(rom?.assets ?? []), [rom?.assets]);
  const emulatorCore = useMemo(() => {
    if (!rom) {
      return undefined;
    }
    const key = rom.platformId.toLowerCase();
    return CORE_BY_PLATFORM[key] ?? 'nes';
  }, [rom]);

  useEffect(() => {
    if (!isSessionReady || !romAsset || !emulatorContainerRef.current) {
      return undefined;
    }

    const emulatorWindow = window as EmulatorWindow;
    emulatorWindow.EJS_player = '#emulator-layer';
    emulatorWindow.EJS_core = emulatorCore ?? 'nes';
    emulatorWindow.EJS_gameUrl = romAsset.url;
    emulatorWindow.EJS_biosUrl = '';
    emulatorWindow.EJS_color = '#f7b733';

    emulatorContainerRef.current.innerHTML = '<div id="emulator-layer" class="play-session__viewport"></div>';

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/dist/embed.js';
    script.async = true;
    scriptRef.current = script;
    emulatorContainerRef.current.appendChild(script);

    return () => {
      script.remove();
      scriptRef.current = null;
      if (emulatorContainerRef.current) {
        emulatorContainerRef.current.innerHTML = '';
      }
      delete emulatorWindow.EJS_player;
      delete emulatorWindow.EJS_core;
      delete emulatorWindow.EJS_gameUrl;
      delete emulatorWindow.EJS_biosUrl;
      delete emulatorWindow.EJS_color;
    };
  }, [emulatorCore, isSessionReady, romAsset]);

  const handleConfirmSession = () => {
    setSessionReady(true);
    setShowPrepDialog(false);
  };

  const handleSaveState = () => {
    if (typeof window === 'undefined') {
      return;
    }
    setIsSaving(true);
    const nextTimestamp = new Date();
    try {
      window.localStorage.setItem(
        getSaveKey(romId),
        JSON.stringify({ romId, savedAt: nextTimestamp.toISOString() })
      );
      setLastSavedAt(nextTimestamp);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadState = () => {
    if (typeof window === 'undefined') {
      return;
    }
    setIsLoadingState(true);
    try {
      const payload = window.localStorage.getItem(getSaveKey(romId));
      if (payload) {
        const parsed = JSON.parse(payload) as { savedAt: string };
        setLastSavedAt(new Date(parsed.savedAt));
      }
    } finally {
      setIsLoadingState(false);
    }
  };

  return (
    <section className="play-session" aria-live="polite">
      <header className="play-session__header">
        <div>
          <p className="eyebrow">Live emulator session</p>
          <h1>{rom?.title ?? 'Preparing ROM…'}</h1>
        </div>
        <button
          type="button"
          className="play-session__cta"
          onClick={() => setShowPrepDialog(true)}
        >
          Controller Map
        </button>
      </header>

      <div className="play-session__stage">
        <div ref={emulatorContainerRef} className="play-session__canvas" aria-label="Emulator viewport">
          {!isSessionReady && (
            <p className="play-session__status">Confirm your controller to start the emulator.</p>
          )}
          {loadState === 'loading' && (
            <p className="play-session__status">Fetching ROM dossier…</p>
          )}
          {loadState === 'error' && error && (
            <p className="play-session__status" role="alert">
              {error}
            </p>
          )}
          {loadState === 'ready' && !romAsset && (
            <p className="play-session__status" role="alert">
              No playable asset was found for this ROM.
            </p>
          )}
        </div>

        {rom && (
          <ControlOverlay
            romTitle={rom.title}
            lastSavedAt={lastSavedAt}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            isSaving={isSaving}
            isLoading={isLoadingState}
            disabled={!isSessionReady}
          />
        )}
      </div>

      <SessionPrepDialog
        open={showPrepDialog}
        romTitle={rom?.title}
        onConfirm={handleConfirmSession}
        onCancel={() => setShowPrepDialog(false)}
      />
    </section>
  );
}

function getSaveKey(romId: string) {
  return `treazr:save:${romId}`;
}

function selectRomBinary(assets: RomAsset[]): RomAsset | undefined {
  return assets.find((asset) => asset.type === 'ROM') ?? assets[0];
}
