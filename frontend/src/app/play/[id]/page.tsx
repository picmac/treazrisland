'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ControlOverlay } from '@/components/emulator/ControlOverlay';
import { TouchOverlay } from '@/components/emulator/TouchOverlay';
import { SessionPrepDialog } from '@/components/emulator/SessionPrepDialog';
import { useToast } from '@/components/ui/ToastProvider';
import { useSaveStates } from '@/hooks/useSaveStates';
import { useViewportScale } from '@/hooks/useViewportScale';
import { fetchRomDetails } from '@/lib/roms';
import { persistSaveState } from '@/lib/saveStates';
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

const EMULATOR_EMBED_URL = process.env.NEXT_PUBLIC_EMULATOR_EMBED_URL;

const ENABLE_VIEWPORT_SCALING = process.env.NEXT_PUBLIC_ENABLE_VIEWPORT_SCALE !== 'false';
const ENABLE_TOUCH_OVERLAY = process.env.NEXT_PUBLIC_ENABLE_TOUCH_OVERLAY !== 'false';

if (!EMULATOR_EMBED_URL) {
  throw new Error(
    'NEXT_PUBLIC_EMULATOR_EMBED_URL must be defined to load the EmulatorJS embed script.',
  );
}

const CORE_BY_PLATFORM: Record<string, string> = {
  nes: 'nes',
  snes: 'snes',
  genesis: 'segaMD',
  megadrive: 'segaMD',
  gba: 'gba',
  gb: 'gb',
  gbc: 'gbc',
  n64: 'n64',
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
  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const { pushToast } = useToast();
  const {
    latestSaveState,
    isLoading: isLoadingCloudSave,
    loadLatestSaveState,
  } = useSaveStates(romId);
  const [isSyncingCloudSave, setIsSyncingCloudSave] = useState(false);

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
    setLastSavedAt(null);
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
        return;
      } catch (storageError) {
        console.warn('Failed to parse saved state timestamp', storageError);
      }
    }
    setLastSavedAt(null);
  }, [romId]);

  useEffect(() => {
    if (!latestSaveState) {
      return;
    }
    setLastSavedAt(new Date(latestSaveState.saveState.updatedAt));
  }, [latestSaveState]);

  const romAsset = useMemo(() => selectRomBinary(rom?.assets ?? []), [rom?.assets]);
  const emulatorCore = useMemo(() => {
    if (!rom) {
      return undefined;
    }
    const key = rom.platformId.toLowerCase();
    return CORE_BY_PLATFORM[key] ?? 'nes';
  }, [rom]);

  useViewportScale(emulatorContainerRef, {
    enabled: ENABLE_VIEWPORT_SCALING && isSessionReady,
  });

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

    const container = emulatorContainerRef.current;
    container.innerHTML = '';
    const viewportNode = document.createElement('div');
    viewportNode.id = 'emulator-layer';
    viewportNode.className = 'play-session__viewport';
    viewportNode.setAttribute('aria-label', 'Emulator viewport');
    viewportNode.setAttribute('role', 'application');
    container.appendChild(viewportNode);

    const script = document.createElement('script');
    script.src = EMULATOR_EMBED_URL;
    script.async = true;
    scriptRef.current = script;
    container.appendChild(script);

    return () => {
      script.remove();
      scriptRef.current = null;
      container.innerHTML = '';
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
        JSON.stringify({ romId, savedAt: nextTimestamp.toISOString() }),
      );
      setLastSavedAt(nextTimestamp);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadState = () => {
    loadLatestSaveState()
      .then((response) => {
        if (!response) {
          pushToast({
            title: 'No cloud save yet',
            description: 'Create a cloud save before loading your progress.',
          });
          return;
        }
        const savedAtLabel = new Date(response.saveState.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        pushToast({ title: 'Cloud save loaded', description: `Checkpoint from ${savedAtLabel}` });
      })
      .catch((loadError) => {
        pushToast({
          title: 'Failed to load save',
          description:
            loadError instanceof Error
              ? loadError.message
              : 'Unable to retrieve the latest save state.',
        });
      });
  };

  const handleSyncCloudSave = async () => {
    if (!rom) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    setIsSyncingCloudSave(true);
    try {
      const savePayload = {
        romId,
        title: rom.title,
        savedAt: new Date().toISOString(),
      };
      const data = encodeToBase64(JSON.stringify(savePayload));
      if (!data) {
        throw new Error('Unable to encode the save payload for upload');
      }
      await persistSaveState(romId, {
        data,
        label: `Session backup • ${rom.title}`,
        slot: 1,
        contentType: 'application/json',
      });
      await loadLatestSaveState();
      pushToast({
        title: 'Save uploaded',
        description: 'Your progress is now synced to Treazr Cloud.',
      });
    } catch (syncError) {
      pushToast({
        title: 'Upload failed',
        description:
          syncError instanceof Error
            ? syncError.message
            : 'Unable to upload your save at the moment.',
      });
    } finally {
      setIsSyncingCloudSave(false);
    }
  };

  return (
    <section className="play-session" aria-live="polite">
      <header className="play-session__header">
        <div>
          <p className="eyebrow">Live emulator session</p>
          <h1>{rom?.title ?? 'Preparing ROM…'}</h1>
        </div>
        <button type="button" className="play-session__cta" onClick={() => setShowPrepDialog(true)}>
          Controller Map
        </button>
      </header>

      <div className="play-session__stage">
        <div className="play-session__canvas">
          <div ref={emulatorContainerRef} className="play-session__viewport-shell" />
          <div className="play-session__status-layer" aria-live="polite">
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
          {ENABLE_TOUCH_OVERLAY && (
            <TouchOverlay enabled={isSessionReady && loadState === 'ready'} />
          )}
        </div>

        {rom && (
          <ControlOverlay
            romTitle={rom.title}
            lastSavedAt={lastSavedAt}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            onSyncCloudSave={handleSyncCloudSave}
            isSaving={isSaving}
            isLoading={isLoadingCloudSave}
            isSyncing={isSyncingCloudSave}
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

function encodeToBase64(value: string) {
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') {
    return '';
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}
