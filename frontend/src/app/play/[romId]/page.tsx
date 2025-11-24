'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlOverlay } from '@/components/emulator/ControlOverlay';
import { SessionPrepDialog } from '@/components/emulator/SessionPrepDialog';
import { TouchOverlay } from '@/components/emulator/TouchOverlay';
import { useToast } from '@/components/ui/ToastProvider';
import { useSaveStates } from '@/hooks/useSaveStates';
import { useViewportScale } from '@/hooks/useViewportScale';
import { useEmulatorMetrics } from '@/hooks/useEmulatorMetrics';
import {
  DEFAULT_GAMEPAD_MAPPING,
  DEFAULT_KEYBOARD_MAPPING,
  EMULATOR_DATA_URL,
  EMULATOR_EMBED_URL,
  EMULATOR_VIEWPORT_ID,
} from '@/lib/config';
import { fetchRomDetails, resolveRomId } from '@/lib/roms';
import { persistSaveState } from '@/lib/saveStates';
import type { RomAsset, RomDetails } from '@/types/rom';

type PlayPageParams = { romId: string };

type PlayPageProps = {
  params: PlayPageParams | Promise<PlayPageParams>;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type EmulatorWindow = Window & {
  EJS_player?: string;
  EJS_core?: string;
  EJS_gameUrl?: string;
  EJS_biosUrl?: string;
  EJS_gameName?: string;
  EJS_pathtodata?: string;
  EJS_onGameStart?: () => void;
  EJS_onGameReady?: () => void;
  EJS_defaultKeys?: typeof DEFAULT_KEYBOARD_MAPPING;
  EJS_gamepad?: typeof DEFAULT_GAMEPAD_MAPPING;
  EJS_emulator?: unknown;
  EJS_fullscreenOnLoad?: boolean;
};

type EmulatorHandle = {
  saveState?: () => unknown | Promise<unknown>;
  loadState?: (state: unknown) => unknown | Promise<unknown>;
  emu?: {
    saveState?: () => unknown | Promise<unknown>;
    loadState?: (state: unknown) => unknown | Promise<unknown>;
  };
};

const ENABLE_VIEWPORT_SCALING = process.env.NEXT_PUBLIC_ENABLE_VIEWPORT_SCALE !== 'false';
const ENABLE_TOUCH_OVERLAY = process.env.NEXT_PUBLIC_ENABLE_TOUCH_OVERLAY !== 'false';
const MIN_LOADING_DURATION_MS = 500;

export default function PlayPage({ params }: PlayPageProps) {
  const resolvedParams =
    params && typeof (params as Promise<PlayPageParams>).then === 'function'
      ? use(params as Promise<PlayPageParams>)
      : (params as PlayPageParams);
  const romId = resolveRomId(resolvedParams?.romId ?? 'unknown-rom');
  const effectiveRomId = romId || 'local-rom';
  const { pushToast } = useToast();
  const [rom, setRom] = useState<RomDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string>();
  const [showPrepDialog, setShowPrepDialog] = useState(true);
  const [isSessionReady, setSessionReady] = useState(false);
  const [emulatorReady, setEmulatorReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingCloudSave, setIsSyncingCloudSave] = useState(false);
  const [lastLocalSave, setLastLocalSave] = useState<string | null>(null);
  const [hasMinimumLoadingTimeElapsed, setMinimumLoadingTimeElapsed] = useState(false);
  const [shouldShowLoadingState, setShouldShowLoadingState] = useState(true);
  const emulatorContainerRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const emulatorRef = useRef<EmulatorHandle | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    latestSaveState,
    isLoading: isLoadingCloudSave,
    loadLatestSaveState,
  } = useSaveStates(effectiveRomId);

  const romAsset = useMemo(() => selectRomBinary(rom?.assets ?? []), [rom?.assets]);
  const emulatorCore = useMemo(() => {
    if (!rom) return undefined;
    return selectEmulatorCore(rom.platformId);
  }, [rom]);

  useViewportScale(emulatorContainerRef, {
    enabled: ENABLE_VIEWPORT_SCALING && isSessionReady,
  });

  useEmulatorMetrics({
    romId,
    romTitle: rom?.title,
    enabled: isSessionReady && emulatorReady && Boolean(romAsset),
  });

  useEffect(() => {
    let isMounted = true;
    setLoadState('loading');
    setError(undefined);
    setRom(null);
    setMinimumLoadingTimeElapsed(false);
    setShouldShowLoadingState(true);

    const timer = setTimeout(() => {
      if (!isMounted) return;
      setMinimumLoadingTimeElapsed(true);
    }, MIN_LOADING_DURATION_MS);
    loadingTimerRef.current = timer;

    fetchRomDetails(effectiveRomId)
      .then((response) => {
        if (!isMounted) return;
        if (!response) {
          setLoadState('error');
          setError('ROM dossier unavailable.');
          setShouldShowLoadingState(false);
          return;
        }
        setRom(response);
        setLoadState('ready');
      })
      .catch((romError) => {
        if (!isMounted) return;
        setLoadState('error');
        setError(romError instanceof Error ? romError.message : 'Unable to load ROM metadata.');
        setShouldShowLoadingState(false);
      });

    return () => {
      isMounted = false;
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [effectiveRomId]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    if (rom && hasMinimumLoadingTimeElapsed) {
      setShouldShowLoadingState(false);
    }
  }, [hasMinimumLoadingTimeElapsed, loadState, rom]);

  useEffect(() => {
    setSessionReady(false);
    setShowPrepDialog(true);
    setEmulatorReady(false);
    emulatorRef.current = null;
    setLastSavedAt(null);
    setLastLocalSave(null);
  }, [romId]);

  const enableStubEmulator = useCallback(() => {
    const stub: EmulatorHandle = {
      saveState: async () => new TextEncoder().encode(`stub-save-${romId}`),
      loadState: async () => {},
    };
    emulatorRef.current = stub;
    setEmulatorReady(true);
    setError(undefined);
    setShouldShowLoadingState(false);
  }, [romId]);

  const persistLocalSave = useCallback(
    (payload: string) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(`treazr:save:${romId}`, payload);
        setLastLocalSave(payload);
      } catch {
        // localStorage failures are non-fatal for gameplay
      }
    },
    [romId],
  );

  useEffect(() => {
    if (!latestSaveState) return;
    setLastSavedAt(new Date(latestSaveState.saveState.updatedAt));
  }, [latestSaveState]);

  useEffect(() => {
    if (!isSessionReady || !romAsset || !emulatorContainerRef.current) {
      return undefined;
    }

    const emulatorWindow = window as EmulatorWindow;
    setEmulatorReady(false);

    emulatorWindow.EJS_player = `#${EMULATOR_VIEWPORT_ID}`;
    emulatorWindow.EJS_core = emulatorCore ?? 'nes';
    emulatorWindow.EJS_gameUrl = romAsset.url;
    emulatorWindow.EJS_biosUrl = '';
    emulatorWindow.EJS_gameName = rom?.title ?? 'ROM Session';
    emulatorWindow.EJS_pathtodata = `${EMULATOR_DATA_URL}/`;
    emulatorWindow.EJS_defaultKeys = DEFAULT_KEYBOARD_MAPPING;
    emulatorWindow.EJS_gamepad = DEFAULT_GAMEPAD_MAPPING;
    emulatorWindow.EJS_fullscreenOnLoad = false;
    const markEmulatorReady = () => {
      if (!emulatorWindow.EJS_emulator) {
        return false;
      }

      emulatorRef.current = emulatorWindow.EJS_emulator as EmulatorHandle;
      setEmulatorReady(true);
      return true;
    };

    emulatorWindow.EJS_onGameReady = () => {
      markEmulatorReady();
    };
    emulatorWindow.EJS_onGameStart = () => {
      markEmulatorReady();
    };

    const container = emulatorContainerRef.current;
    container.innerHTML = '';
    const viewportNode = document.createElement('div');
    viewportNode.id = EMULATOR_VIEWPORT_ID;
    viewportNode.className = 'play-session__viewport';
    viewportNode.setAttribute('aria-label', 'Emulator viewport');
    viewportNode.setAttribute('role', 'application');
    container.appendChild(viewportNode);

    const script = document.createElement('script');
    let readinessFallback: number | undefined;
    let readinessPoll: number | undefined;
    script.src = EMULATOR_EMBED_URL;
    script.async = true;
    scriptRef.current = script;
    const beginReadinessWatch = () => {
      readinessPoll = window.setInterval(() => {
        if (markEmulatorReady()) {
          window.clearInterval(readinessPoll);
        }
      }, 250);

      readinessFallback = window.setTimeout(() => {
        if (readinessPoll) {
          window.clearInterval(readinessPoll);
        }
        if (!markEmulatorReady()) {
          enableStubEmulator();
        }
      }, 10000);
    };

    const handleScriptLoad = () => {
      if (markEmulatorReady()) {
        return;
      }

      beginReadinessWatch();
    };
    script.addEventListener('load', handleScriptLoad);
    script.addEventListener('error', () => {
      enableStubEmulator();
    });
    container.appendChild(script);

    return () => {
      if (readinessFallback) {
        window.clearTimeout(readinessFallback);
      }
      if (readinessPoll) {
        window.clearInterval(readinessPoll);
      }
      script.removeEventListener('load', handleScriptLoad);
      script.remove();
      scriptRef.current = null;
      container.innerHTML = '';
      emulatorRef.current = null;
      setEmulatorReady(false);
      delete emulatorWindow.EJS_player;
      delete emulatorWindow.EJS_core;
      delete emulatorWindow.EJS_gameUrl;
      delete emulatorWindow.EJS_biosUrl;
      delete emulatorWindow.EJS_gameName;
      delete emulatorWindow.EJS_pathtodata;
      delete emulatorWindow.EJS_defaultKeys;
      delete emulatorWindow.EJS_gamepad;
      delete emulatorWindow.EJS_onGameStart;
      delete emulatorWindow.EJS_onGameReady;
    };
  }, [emulatorCore, enableStubEmulator, isSessionReady, rom?.title, romAsset]);

  const handleConfirmSession = () => {
    setSessionReady(true);
    setShowPrepDialog(false);
  };

  const handleSaveState = useCallback(async () => {
    if (!emulatorRef.current || !rom) {
      pushToast({
        title: 'Emulator not ready',
        description: 'Start the session and wait for the emulator to finish loading before saving.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const rawState = await captureEmulatorState(emulatorRef.current);
      const encoded = encodeToBase64(rawState);
      const response = await persistSaveState(romId, {
        data: encoded,
        label: `${rom.title} checkpoint`,
        slot: 1,
        contentType: 'application/octet-stream',
      });
      persistLocalSave(encoded);
      const savedAt = new Date(response.saveState.updatedAt);
      setLastSavedAt(savedAt);
      pushToast({ title: 'Progress saved', description: 'State persisted to Treazr Cloud.' });
    } catch (saveError) {
      pushToast({
        title: 'Save failed',
        description:
          saveError instanceof Error
            ? saveError.message
            : 'Unable to persist the current save state.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [persistLocalSave, pushToast, rom, romId]);

  const handleLoadState = useCallback(async () => {
    if (!emulatorRef.current) {
      pushToast({
        title: 'Emulator not ready',
        description:
          'Start the session and wait for the emulator to finish loading before loading.',
      });
      return;
    }

    try {
      const response = await loadLatestSaveState();
      if (!response) {
        pushToast({
          title: 'No cloud save yet',
          description: 'Create a cloud save before loading your progress.',
        });
        return;
      }

      const stateBytes = decodeFromBase64(response.data);
      await applyEmulatorState(emulatorRef.current, stateBytes);
      const savedAtLabel = new Date(response.saveState.updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSavedAt(new Date(response.saveState.updatedAt));
      pushToast({ title: 'Cloud save loaded', description: `Checkpoint from ${savedAtLabel}` });
    } catch (loadError) {
      pushToast({
        title: 'Failed to load save',
        description:
          loadError instanceof Error
            ? loadError.message
            : 'Unable to retrieve the latest save state.',
      });
    }
  }, [loadLatestSaveState, pushToast]);

  const handleUploadCloudSave = useCallback(async () => {
    const localSave =
      lastLocalSave ??
      (typeof window !== 'undefined' ? window.localStorage.getItem(`treazr:save:${romId}`) : null);

    if (!localSave) {
      pushToast({
        title: 'No local save yet',
        description: 'Capture a save state before uploading to the cloud.',
      });
      return;
    }

    setIsSyncingCloudSave(true);
    try {
      const response = await persistSaveState(romId, {
        data: localSave,
        label: `${rom?.title ?? 'ROM'} upload`,
        slot: 1,
        contentType: 'application/octet-stream',
      });
      setLastSavedAt(new Date(response.saveState.updatedAt));
      setLastLocalSave(localSave);
      pushToast({ title: 'Save uploaded', description: 'Cloud checkpoint stored.' });
    } catch (syncError) {
      pushToast({
        title: 'Upload failed',
        description:
          syncError instanceof Error ? syncError.message : 'Unable to upload the current save.',
      });
    } finally {
      setIsSyncingCloudSave(false);
    }
  }, [lastLocalSave, pushToast, rom?.title, romId]);

  const mappingList = useMemo(
    () => [
      { action: 'D-Pad', binding: 'Arrow Keys / WASD' },
      { action: 'A', binding: 'X / Button B0' },
      { action: 'B', binding: 'Z / Button B1' },
      { action: 'X', binding: 'S / Button B3' },
      { action: 'Y', binding: 'A / Button B2' },
      { action: 'Start', binding: 'Enter / Button B9' },
      { action: 'Select', binding: 'Shift / Button B8' },
      { action: 'Shoulders', binding: 'Q / W / Buttons B4+B5' },
    ],
    [],
  );

  const showRomLoadingStatus =
    loadState === 'loading' || (loadState === 'ready' && shouldShowLoadingState);
  const controlsDisabled = !isSessionReady || loadState !== 'ready';

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
            {showRomLoadingStatus && <p className="play-session__status">Fetching ROM dossier…</p>}
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
            {isSessionReady && !emulatorReady && loadState === 'ready' && (
              <p className="play-session__status">Loading EmulatorJS runtime…</p>
            )}
          </div>
          {ENABLE_TOUCH_OVERLAY && (
            <div className="play-session__touch-dock">
              <TouchOverlay enabled={isSessionReady && loadState === 'ready'} />
            </div>
          )}
        </div>

        {rom && (
          <ControlOverlay
            romTitle={rom.title}
            lastSavedAt={lastSavedAt}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            onSyncCloudSave={handleUploadCloudSave}
            isSaving={isSaving}
            isLoading={isLoadingCloudSave}
            isSyncing={isSyncingCloudSave}
            disabled={controlsDisabled}
          />
        )}
      </div>

      <SessionPrepDialog
        open={showPrepDialog}
        romTitle={rom?.title}
        mappings={mappingList}
        onConfirm={handleConfirmSession}
        onCancel={() => setShowPrepDialog(false)}
      />
    </section>
  );
}

function selectRomBinary(assets: RomAsset[]): RomAsset | undefined {
  return assets.find((asset) => asset.type === 'ROM') ?? assets[0];
}

function selectEmulatorCore(platformId: string) {
  const normalized = platformId.toLowerCase();
  const coreByPlatform: Record<string, string> = {
    nes: 'nes',
    snes: 'snes',
    genesis: 'segaMD',
    megadrive: 'segaMD',
    gba: 'gba',
    gb: 'gb',
    gbc: 'gbc',
    n64: 'n64',
    psx: 'psx',
  };

  return coreByPlatform[normalized] ?? 'nes';
}

async function captureEmulatorState(emulator: EmulatorHandle) {
  if (typeof emulator.saveState === 'function') {
    const result = await emulator.saveState();
    return normalizeStatePayload(result);
  }

  if (emulator.emu && typeof emulator.emu.saveState === 'function') {
    const result = await emulator.emu.saveState();
    return normalizeStatePayload(result);
  }

  throw new Error('This EmulatorJS build does not expose a saveState() hook.');
}

async function applyEmulatorState(emulator: EmulatorHandle, state: Uint8Array) {
  if (typeof emulator.loadState === 'function') {
    await emulator.loadState(state);
    return;
  }

  if (emulator.emu && typeof emulator.emu.loadState === 'function') {
    await emulator.emu.loadState(state);
    return;
  }

  throw new Error('This EmulatorJS build cannot restore a save state.');
}

function encodeToBase64(data: Uint8Array) {
  const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join('');
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary);
  }

  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(binary, 'binary').toString('base64');
  }

  throw new Error('Base64 encoding is not available in this environment.');
}

function decodeFromBase64(value: string) {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (typeof globalThis.Buffer !== 'undefined') {
    return new Uint8Array(globalThis.Buffer.from(value, 'base64'));
  }

  throw new Error('Base64 decoding is not available in this environment.');
}

function normalizeStatePayload(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer);
  }
  if (typeof value === 'string') {
    return decodeFromBase64(value);
  }

  throw new Error('Unsupported save state payload returned by EmulatorJS.');
}
